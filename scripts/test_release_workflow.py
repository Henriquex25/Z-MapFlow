"""Exercise release gates and draft-only operations without accessing GitHub."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import create_release_draft as draft
import project_version
import release_preflight as preflight


class VersionSourceTest(unittest.TestCase):
    def test_root_version_and_rejected_formats(self):
        self.assertEqual(project_version.VERSION_FILE, project_version.ROOT / "VERSION")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "VERSION"
            with patch.object(project_version, "VERSION_FILE", path):
                path.write_text(" 1.2.3\n")
                self.assertEqual(project_version.current_version(), "1.2.3")
                for value in ["", "v1.2.3", "01.2.3", "1.2", "1.2.3-beta", "1.2١.3", "1" * 65]:
                    path.write_text(value)
                    with self.subTest(value=value), self.assertRaises(ValueError):
                        project_version.current_version()


class PreflightTest(unittest.TestCase):
    repository = "Henriquex25/Z-MapFlow"
    sha = "a" * 40

    def successful_run(self):
        return {"head_sha": self.sha, "head_branch": "main", "event": "push",
                "status": "completed", "conclusion": "success",
                "head_repository": {"full_name": self.repository}}

    def test_requires_completed_push_ci_for_exact_main_commit_and_repository(self):
        valid = self.successful_run()
        invalid = [dict(valid, **change) for change in [
            {"head_sha": "b" * 40}, {"head_branch": "feature"}, {"event": "pull_request"},
            {"status": "in_progress"}, {"conclusion": "failure"},
            {"head_repository": {"full_name": "someone/fork"}},
        ]]
        for run in invalid:
            with self.subTest(run=run), patch.object(preflight.subprocess, "check_output", return_value=json.dumps({"workflow_runs": [run]})):
                with self.assertRaises(ValueError):
                    preflight.require_ci(self.repository, self.sha)
        with patch.object(preflight.subprocess, "check_output", return_value=json.dumps({"workflow_runs": [*invalid, valid]})) as request:
            preflight.require_ci(self.repository, self.sha)
            endpoint = request.call_args.args[0][-1]
            self.assertIn(f"head_sha={self.sha}", endpoint)
            self.assertIn("event=push", endpoint)

    def test_rejects_non_main_and_invalid_context_before_requests(self):
        for change in [{"GITHUB_REF": "refs/heads/feature"}, {"GITHUB_REF": "refs/tags/v1.2.3"},
                       {"GITHUB_SHA": "main"}, {"GITHUB_REPOSITORY": "--invalid"}]:
            with patch.dict(os.environ, {"GITHUB_REF": "refs/heads/main", "GITHUB_SHA": self.sha, "GITHUB_REPOSITORY": self.repository, **change}, clear=True):
                with self.subTest(change=change), self.assertRaises(ValueError):
                    preflight.release_context()

    def test_exports_version_only_after_ci_gate(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "output"
            env = {"GITHUB_REF": "refs/heads/main", "GITHUB_SHA": self.sha,
                   "GITHUB_REPOSITORY": self.repository, "GITHUB_OUTPUT": str(output)}
            with patch.dict(os.environ, env, clear=True), patch.object(preflight, "require_ci") as gate:
                preflight.main()
                gate.assert_called_once_with(self.repository, self.sha)
                self.assertEqual(output.read_text(), f"version={project_version.current_version()}\n")
            output.unlink()
            with patch.dict(os.environ, env, clear=True), patch.object(preflight, "require_ci", side_effect=ValueError("CI failed")):
                with self.assertRaises(ValueError): preflight.main()
                self.assertFalse(output.exists())


class DraftTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.version = project_version.current_version()
        self.sha = "a" * 40
        env = {"GITHUB_REF": "refs/heads/main", "GITHUB_SHA": self.sha,
               "GITHUB_REPOSITORY": "Henriquex25/Z-MapFlow", "RELEASE_COMMIT": self.sha,
               "RELEASE_VERSION": self.version}
        env_patch = patch.dict(os.environ, env, clear=True)
        env_patch.start()
        self.addCleanup(env_patch.stop)
        names = draft.asset_names(self.version)
        for name in names: (self.directory / name).write_bytes(b"packaged release bytes")
        (self.directory / "checksums.txt").write_text("".join(
            f"{hashlib.sha256((self.directory / name).read_bytes()).hexdigest()}  {name}\n" for name in names))

    def test_creates_draft_with_all_assets_exact_commit_and_generated_notes(self):
        with patch.object(draft.subprocess, "run", side_effect=[subprocess.CompletedProcess([], 1, "", "not found"), subprocess.CompletedProcess([], 0)]) as commands:
            draft.main(self.directory)
            create = commands.call_args_list[-1].args[0]
            self.assertEqual(create[:4], ["gh", "release", "create", f"v{self.version}"])
            self.assertIn("--draft", create)
            self.assertIn("--generate-notes", create)
            self.assertEqual(create[create.index("--target") + 1], self.sha)
            self.assertIn(str(self.directory / "checksums.txt"), create)
            self.assertEqual(len([name for name in create if name.startswith(str(self.directory))]), 5)
            self.assertNotIn("--latest", create)

    def test_resumes_only_a_draft_for_the_same_commit_without_replacing_notes(self):
        existing = json.dumps({"isDraft": True, "targetCommitish": self.sha})
        with patch.object(draft.subprocess, "run", side_effect=[subprocess.CompletedProcess([], 0, existing), subprocess.CompletedProcess([], 0)]) as commands:
            draft.main(self.directory)
            upload = commands.call_args_list[-1].args[0]
            self.assertEqual(upload[:3], ["gh", "release", "upload"])
            self.assertIn("--clobber", upload)
            self.assertNotIn("--generate-notes", upload)

    def test_cannot_modify_published_releases_or_other_commits(self):
        for existing in [{"isDraft": False, "targetCommitish": self.sha}, {"isDraft": True, "targetCommitish": "b" * 40}]:
            with self.subTest(existing=existing), patch.object(draft.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.dumps(existing))) as commands:
                with self.assertRaises(ValueError): draft.main(self.directory)
                self.assertEqual(commands.call_count, 1)

    def test_corrupt_assets_or_changed_version_do_not_reach_github(self):
        with patch.object(draft.subprocess, "run") as commands:
            with patch.dict(os.environ, {"RELEASE_VERSION": "999.0.0"}):
                with self.assertRaises(ValueError): draft.main(self.directory)
            (self.directory / "z-mapflow_linux_amd64").write_bytes(b"corrupt")
            with self.assertRaises(ValueError): draft.main(self.directory)
            commands.assert_not_called()


if __name__ == "__main__":
    unittest.main()

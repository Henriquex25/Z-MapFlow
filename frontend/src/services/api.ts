import { useAppPreferences } from "../i18n/preferences";
import * as go from "../../wailsjs/go/main/App";
import { models } from "../../wailsjs/go/models";
import type { Project, Build, Session, Plugin } from "../types/keyboard";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
const model = (p: Project) => models.Project.createFrom(p);
export type CommunityKind = "star" | "donation";
export const communityLinks = {
  star: "https://github.com/Henriquex25/Z-MapFlow",
  donation: "https://www.buymeacoffee.com/henriquemiranda",
} as const;
async function native<T>(run: () => Promise<T>): Promise<T> {
  await go.SetAppLanguage(useAppPreferences.getState().locale);
  return run();
}
export const api = {
  communityStatus: go.GetCommunityStatus,
  recordCommunityMinute: go.RecordCommunityMinute,
  dismissCommunityPrompt: go.DismissCommunityPrompt,
  openCommunityPage: (kind: CommunityKind) => BrowserOpenURL(communityLinks[kind]),
  findLanguageHeaders: () =>
    BrowserOpenURL("https://github.com/joelspadin/zmk-locale-generator/releases/latest"),
  appInfo: go.GetAppInfo,
  checkUpdates: go.CheckForUpdates,
  updateProgress: go.GetUpdateProgress,
  installUpdate: go.InstallUpdate,
  load: (): Promise<Session> => go.LoadProject(),
  newProject: (id: string): Promise<Session> => go.NewProject(id),
  plugins: (): Promise<Plugin[]> => go.ListPlugins(),
  save: (p: Project): Promise<Project> => go.SaveProject(model(p)),
  saveAndBuild: (p: Project): Promise<Project> => go.SaveAndBuild(model(p)),
  build: go.StartBuild,
  status: (): Promise<Build | null> => go.GetBuildStatus(),
  cancelBuild: go.CancelBuild,
  listBuilds: go.ListBuilds,
  getBuild: (id: string): Promise<Build> => go.GetBuild(id),
  preview: (p: Project) => go.PreviewSources(model(p)),
  importProject: (pluginId = "", variantId = ""): Promise<Session> =>
    native(() => go.ImportProject(pluginId, variantId)),
  importHeaders: () => native(() => go.ImportHeaders()),
  exportProject: (p: Project) => native(() => go.ExportProject(model(p))),
  exportKeymap: (p: Project) => native(() => go.ExportKeymap(model(p))),
  exportFirmware: (id: string) => native(() => go.ExportFirmware(id)),
  volumes: go.FindBootloaders,
  selectVolume: (id: string) => native(() => go.SelectBootloader(id)),
  flash: go.FlashFirmware,
};

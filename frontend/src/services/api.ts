import { useAppPreferences } from "../i18n/preferences";
import * as go from "../../wailsjs/go/main/App";
import { models } from "../../wailsjs/go/models";
import type { Project, Build, Session, Plugin, FlashPlan } from "../types/keyboard";
import { BrowserOpenURL, EventsOn } from "../../wailsjs/runtime/runtime";
export type FlashProgress = {
  buildId: string;
  targetId: string;
  stage: "checking" | "opening" | "copying" | "syncing" | "closing";
  written: number;
  total: number;
};
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
  sleepTimeoutMilliseconds: go.SleepTimeoutMilliseconds,
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
  flashDevice: go.FlashDevice,
  getFlashPlan: (buildId: string): Promise<FlashPlan> => go.GetFlashPlan(buildId),
  undoFlashSetupSelection: (buildId: string): Promise<FlashPlan> =>
    go.UndoFlashSetupSelection(buildId),
  setInstalledTopology: (buildId: string, variantId: string): Promise<FlashPlan> =>
    go.SetInstalledTopology(buildId, variantId),
  setResetController: (buildId: string, deviceId: string, controller: string): Promise<FlashPlan> =>
    go.SetResetController(buildId, deviceId, controller),
  reportExternalFlash: (buildId: string): Promise<FlashPlan> => go.ReportExternalFlash(buildId),
  acknowledgeFlash: (buildId: string, receiptId: string): Promise<FlashPlan> =>
    go.AcknowledgeFlash(buildId, receiptId),
  onFlashProgress: (callback: (progress: FlashProgress) => void) =>
    EventsOn("firmware:flash", callback),
};

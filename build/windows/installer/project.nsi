Unicode true

; Per-user installation keeps automatic updates writable without elevation.
!ifndef REQUEST_EXECUTION_LEVEL
  !define REQUEST_EXECUTION_LEVEL "user"
!endif
!ifndef WAILS_INSTALL_SCOPE
  !define WAILS_INSTALL_SCOPE "user"
!endif
!if "${WAILS_INSTALL_SCOPE}" != "user"
  !error "Z-MapFlow requires -installscope user"
!endif
!include "wails_tools.nsh"
!include "MUI2.nsh"

VIProductVersion "${INFO_PRODUCTVERSION}.0"
VIFileVersion "${INFO_PRODUCTVERSION}.0"
VIAddVersionKey "CompanyName" "${INFO_COMPANYNAME}"
VIAddVersionKey "FileDescription" "${INFO_PRODUCTNAME} Installer"
VIAddVersionKey "ProductVersion" "${INFO_PRODUCTVERSION}"
VIAddVersionKey "FileVersion" "${INFO_PRODUCTVERSION}"
VIAddVersionKey "LegalCopyright" "${INFO_COPYRIGHT}"
VIAddVersionKey "ProductName" "${INFO_PRODUCTNAME}"
ManifestDPIAware true
SetCompressor /SOLID lzma

Name "${INFO_PRODUCTNAME}"
OutFile "..\..\bin\${INFO_PROJECTNAME}-${ARCH}-installer.exe"
InstallDir "$LOCALAPPDATA\Programs\${INFO_PRODUCTNAME}"
ShowInstDetails show
!define MUI_ICON "..\icon.ico"
!define MUI_UNICON "..\icon.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXECUTABLE}"
!define MUI_FINISHPAGE_RUN_TEXT "Open Z-MapFlow"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

; Match platform_windows.go. Never overwrite an app with unsaved work open.
!macro requireAppClosed
  System::Call 'kernel32::OpenMutexW(i 0x100000, i 0, w "wails-app-01db25a7-5a15-4a35-babe-ef066613032esim") p.r0'
  ${If} $0 != 0
    System::Call 'kernel32::CloseHandle(p r0)'
    IfSilent +2
    MessageBox MB_OK|MB_ICONEXCLAMATION "Close Z-MapFlow before installing or removing it. Your saved projects will be kept."
    SetErrorLevel 2
    Abort
  ${EndIf}
!macroend

Function .onInit
  !insertmacro wails.checkArchitecture
  !insertmacro requireAppClosed
FunctionEnd
Function un.onInit
  !insertmacro requireAppClosed
FunctionEnd

Section "Install"
  !insertmacro wails.setShellContext
  !insertmacro wails.webview2runtime
  SetOutPath $INSTDIR
  ClearErrors
  !insertmacro wails.files
  IfErrors 0 +3
    MessageBox MB_OK|MB_ICONSTOP "Could not install Z-MapFlow. Close the app and try again."
    Abort
  File "..\..\..\LICENSE"
  SetOutPath "$INSTDIR\licenses"
  File /r "..\..\..\frontend\public\licenses\*"
  SetOutPath $INSTDIR
  CreateShortcut "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
  CreateShortcut "$DESKTOP\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
  !insertmacro wails.writeUninstaller
SectionEnd

Section "Uninstall"
  !insertmacro wails.setShellContext
  ; Remove only files owned by the application, preserving config/projects and
  ; unrelated files even if the installation directory was manually overridden.
  Delete "$INSTDIR\${PRODUCT_EXECUTABLE}"
  Delete "$INSTDIR\${PRODUCT_EXECUTABLE}.previous"
  Delete "$INSTDIR\.z-mapflow-helper-*"
  Delete "$INSTDIR\.z-mapflow-update-*"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\licenses\Fira-OFL.txt"
  Delete "$INSTDIR\licenses\serial-BSD.txt"
  RMDir "$INSTDIR\licenses"
  Delete "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk"
  Delete "$DESKTOP\${INFO_PRODUCTNAME}.lnk"
  !insertmacro wails.deleteUninstaller
  RMDir "$INSTDIR"
SectionEnd

; Custom NSIS Installer Script for Wellbore Schematic Pro
; Configures step-by-step installation flow with License Agreement, Rules, Destination Folder, and Modern Styling

!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "Wellbore Schematic Pro Setup Wizard"
  !define MUI_WELCOMEPAGE_TEXT "Welcome to the Setup Wizard for Wellbore Schematic Pro.\r\n\r\nThis professional engineering software includes:\r\n• Embedded SQLite Local Database Engine (100% Offline & Corporate Proxy Compatible)\r\n• Dynamic Wellbore Schematic Rendering & Depth Calculation\r\n• Perforation, Casing, Tubing, and Cement Plug (B.C) Tracking\r\n• Optional Cloud Synchronization\r\n\r\nClick Next to review the application license, terms of use, and rules before installing."
  
  !define MUI_LICENSEPAGE_TITLE "Software License Agreement & Rules of Use"
  !define MUI_LICENSEPAGE_TEXT_TOP "Please carefully read the following license agreement and database usage rules before installing."
  !define MUI_LICENSEPAGE_TEXT_BOTTOM "If you accept all terms and rules of the agreement, click 'I Agree' to select your installation directory and proceed."
  
  !define MUI_DIRECTORYPAGE_TITLE "Choose Installation Location"
  !define MUI_DIRECTORYPAGE_TEXT_TOP "Select the destination folder on your computer where Wellbore Schematic Pro will be installed."
  !define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Destination Folder:"
!macroend

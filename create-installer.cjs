const winstaller = require('electron-winstaller');
const path = require('path');

async function createInstaller() {
  console.log('Generating Windows installer...');
  try {
    await winstaller.createWindowsInstaller({
      appDirectory: path.join(__dirname, 'build-desktop', 'Wellbore Pro-win32-x64'),
      outputDirectory: path.join(__dirname, 'build-desktop', 'installer'),
      authors: 'oh.a.halim',
      description: 'Wellbore Pro Studio - Managed Well completions',
      exe: 'Wellbore Pro.exe',
      setupExe: 'Wellbore Pro Setup.exe',
      setupIcon: path.join(__dirname, 'wellborePro.ico'),
      noMsi: true
    });
    console.log('Installer created successfully!');
  } catch (e) {
    console.error('Error creating installer:', e.message);
    process.exit(1);
  }
}

createInstaller();

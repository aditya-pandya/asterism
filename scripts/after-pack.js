const { execFileSync } = require('node:child_process');
const path = require('node:path');

const PLIST_BUDDY = '/usr/libexec/PlistBuddy';

const PRIVACY_KEYS_TO_REMOVE = [
  'NSAppTransportSecurity',
  'NSAudioCaptureUsageDescription',
  'NSBluetoothAlwaysUsageDescription',
  'NSBluetoothPeripheralUsageDescription',
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription'
];

function runPlistCommand(plistPath, command, options = {}) {
  try {
    execFileSync(PLIST_BUDDY, ['-c', command, plistPath], { stdio: 'pipe' });
  } catch (error) {
    if (!options.ignoreFailure) {
      throw error;
    }
  }
}

async function afterPack(context) {
  const productFilename = context.packager.appInfo.productFilename;
  const infoPlistPath = path.join(context.appOutDir, `${productFilename}.app`, 'Contents', 'Info.plist');

  for (const key of PRIVACY_KEYS_TO_REMOVE) {
    runPlistCommand(infoPlistPath, `Delete :${key}`, { ignoreFailure: true });
  }

  console.log(`Sanitized macOS privacy metadata in ${infoPlistPath}`);
}

module.exports = afterPack;
module.exports.default = afterPack;

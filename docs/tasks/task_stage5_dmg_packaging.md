# 任务：应用打包和分发

## 任务信息
- **阶段**: 5 - Obsidian导出和应用打包
- **估时**: 8小时
- **优先级**: 高
- **依赖**: task_stage5_obsidian_export

## 任务目标
配置完整的应用打包流程，包括代码签名、公证和自动更新功能。

## 具体任务
1. **electron-builder配置优化**
   - macOS应用打包配置
   - 图标和资源文件设置
   - 文件包含/排除规则
   - 构建优化设置

2. **macOS代码签名和公证**
   - Developer ID证书配置
   - 代码签名自动化
   - Apple公证流程集成
   - Gatekeeper兼容性

3. **DMG安装包制作**
   - 自定义DMG背景和布局
   - 应用程序文件夹快捷方式
   - 安装包验证和测试
   - 文件大小优化

4. **自动更新机制**
   - electron-updater配置
   - 更新服务器设置
   - 增量更新支持
   - 更新通知和用户体验

## 验收标准
- [ ] DMG安装包可正常安装和卸载
- [ ] 应用通过macOS安全检查
- [ ] 代码签名和公证完成
- [ ] 自动更新功能正常工作
- [ ] 安装包大小≤500MB
- [ ] 应用启动时间≤3秒

## Electron Builder配置

### 完整构建配置
```javascript
// electron-builder.config.js
const { version } = require('./package.json');

module.exports = {
  appId: 'com.easypod.app',
  productName: 'EasyPod',
  copyright: 'Copyright © 2024 EasyPod Team',

  directories: {
    output: 'dist',
    buildResources: 'build',
  },

  files: [
    'dist-electron/**/*',
    'dist/**/*',
    'node_modules/**/*',
    {
      from: 'resources',
      to: 'resources',
      filter: ['**/*'],
    },
  ],

  extraFiles: [
    {
      from: 'resources/bin',
      to: 'bin',
      filter: ['**/*'],
    },
    {
      from: 'resources/models',
      to: 'models',
      filter: ['**/*'],
    },
    {
      from: 'resources/python',
      to: 'python',
      filter: ['**/*'],
    },
  ],

  mac: {
    category: 'public.app-category.productivity',
    icon: 'build/icons/icon.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    notarize: {
      teamId: process.env.APPLE_TEAM_ID,
    },
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    extendInfo: {
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'OPML Document',
          CFBundleTypeExtensions: ['opml'],
          CFBundleTypeRole: 'Editor',
          LSHandlerRank: 'Owner',
        },
        {
          CFBundleTypeName: 'Audio File',
          CFBundleTypeExtensions: ['mp3', 'aac', 'm4a', 'ogg'],
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
        },
      ],
      NSMicrophoneUsageDescription: 'EasyPod需要访问麦克风以进行音频录制和处理。',
      NSCameraUsageDescription: 'EasyPod可能需要访问相机以处理视频播客内容。',
      NSAppleEventsUsageDescription: 'EasyPod需要发送Apple事件以与其他应用程序集成。',
      LSEnvironment: {
        PATH: '/usr/local/bin:/usr/bin:/bin',
        PYTHONPATH: '$PYTHONPATH:$resourcesPath/python',
      },
    },
  },

  dmg: {
    sign: false, // 不签名DMG，只签名app
    title: '${productName} ${version}',
    icon: 'build/icons/volume-icon.icns',
    background: 'build/dmg-background.png',
    window: {
      width: 640,
      height: 480,
    },
    contents: [
      {
        x: 180,
        y: 170,
        type: 'file',
      },
      {
        x: 480,
        y: 170,
        type: 'link',
        path: '/Applications',
      },
    ],
    additionalDMGOptions: {
      window: {
        position: {
          x: 400,
          y: 100,
        },
      },
    },
  },

  publish: [
    {
      provider: 'github',
      owner: 'easypod',
      repo: 'easypod-releases',
      private: true,
    },
  ],

  afterSign: 'scripts/notarize.js',

  compression: 'maximum',

  nsis: false, // 不需要Windows安装器
  linux: false, // 不需要Linux构建
};
```

### 权限配置文件
```xml
<!-- build/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.files.downloads.read-write</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
  </dict>
</plist>
```

## 代码签名和公证

### 公证脚本
```javascript
// scripts/notarize.js
const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    console.log('Skipping notarization: APPLE_ID and APPLE_ID_PASSWORD not set');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}...`);

  try {
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });

    console.log('Notarization successful!');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
```

### 构建脚本
```javascript
// scripts/build.js
const builder = require('electron-builder');
const path = require('path');
const fs = require('fs');

async function build() {
  // 检查环境变量
  const requiredEnvVars = [
    'CSC_IDENTITY_AUTO_DISCOVERY',
    'APPLE_ID',
    'APPLE_ID_PASSWORD',
    'APPLE_TEAM_ID',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Code signing and notarization may fail.');
  }

  // 检查证书
  if (process.platform === 'darwin') {
    try {
      const { execSync } = require('child_process');
      const result = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' });

      if (!result.includes('Developer ID Application')) {
        console.warn('Warning: Developer ID Application certificate not found');
      } else {
        console.log('✓ Code signing certificate found');
      }
    } catch (error) {
      console.warn('Could not verify code signing certificate:', error.message);
    }
  }

  // 清理之前的构建
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    console.log('Cleaning previous build...');
    fs.rmSync(distPath, { recursive: true, force: true });
  }

  // 构建参数
  const config = {
    targets: builder.Platform.MAC.createTarget(['dmg', 'zip'], builder.Arch.universal),
    config: {
      ...require('../electron-builder.config.js'),
      // 运行时配置覆盖
      extraMetadata: {
        version: process.env.BUILD_VERSION || require('../package.json').version,
        buildNumber: process.env.BUILD_NUMBER || Date.now().toString(),
      },
    },
  };

  try {
    console.log('Starting build process...');
    const result = await builder.build(config);

    console.log('Build completed successfully!');
    console.log('Artifacts:', result.map(r => r.file).join(', '));

    // 验证构建结果
    await verifyBuild(result);

    return result;
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

async function verifyBuild(artifacts) {
  console.log('Verifying build artifacts...');

  for (const artifact of artifacts) {
    const filePath = artifact.file;
    const stats = fs.statSync(filePath);

    console.log(`✓ ${path.basename(filePath)}: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);

    // 验证DMG
    if (filePath.endsWith('.dmg')) {
      await verifyDMG(filePath);
    }

    // 验证代码签名
    if (filePath.endsWith('.app') || filePath.endsWith('.dmg')) {
      await verifyCodeSign(filePath);
    }
  }
}

async function verifyDMG(dmgPath) {
  try {
    const { execSync } = require('child_process');

    // 挂载DMG
    console.log('Verifying DMG structure...');
    const mountResult = execSync(`hdiutil attach "${dmgPath}" -nobrowse -readonly`, { encoding: 'utf8' });
    const mountPoint = mountResult.match(/\/Volumes\/.+$/m)?.[0];

    if (mountPoint) {
      // 检查应用是否存在
      const appExists = fs.existsSync(path.join(mountPoint, 'EasyPod.app'));
      const applicationsLinkExists = fs.existsSync(path.join(mountPoint, 'Applications'));

      console.log(`✓ App exists in DMG: ${appExists}`);
      console.log(`✓ Applications link exists: ${applicationsLinkExists}`);

      // 卸载DMG
      execSync(`hdiutil detach "${mountPoint}"`);
    }
  } catch (error) {
    console.warn('DMG verification failed:', error.message);
  }
}

async function verifyCodeSign(filePath) {
  try {
    const { execSync } = require('child_process');

    // 验证代码签名
    const codesignResult = execSync(`codesign -vv "${filePath}"`, { encoding: 'utf8' });
    console.log('✓ Code signature valid');

    // 验证公证状态
    if (filePath.endsWith('.app')) {
      const spctlResult = execSync(`spctl -a -vv "${filePath}"`, { encoding: 'utf8' });
      console.log('✓ Gatekeeper assessment passed');
    }
  } catch (error) {
    console.warn('Code signing verification failed:', error.message);
  }
}

if (require.main === module) {
  build().catch(console.error);
}

module.exports = { build };
```

## 自动更新配置

### 更新服务配置
```typescript
// src/main/services/UpdateService.ts
import { autoUpdater } from 'electron-updater';
import { app, dialog, BrowserWindow } from 'electron';
import log from 'electron-log';

interface UpdateInfo {
  version: string;
  files: Array<{
    url: string;
    sha512: string;
    size: number;
  }>;
  path: string;
  sha512: string;
  releaseDate: string;
  releaseName?: string;
  releaseNotes?: string;
}

class UpdateService {
  private mainWindow: BrowserWindow | null = null;
  private updateDownloaded = false;

  constructor() {
    this.setupAutoUpdater();
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private setupAutoUpdater(): void {
    // 配置日志
    autoUpdater.logger = log;
    log.transports.file.level = 'info';

    // 配置更新服务器
    if (process.env.NODE_ENV === 'development') {
      autoUpdater.updateConfigPath = path.join(__dirname, '../../dev-app-update.yml');
    }

    // 禁用自动下载
    autoUpdater.autoDownload = false;

    // 禁用自动安装
    autoUpdater.autoInstallOnAppQuit = false;

    // 事件监听
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...');
      this.sendUpdateStatus('checking');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log.info('Update available:', info);
      this.sendUpdateStatus('available', info);
      this.showUpdateAvailableDialog(info);
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      log.info('Update not available:', info);
      this.sendUpdateStatus('not-available', info);
    });

    autoUpdater.on('error', (err: Error) => {
      log.error('Auto updater error:', err);
      this.sendUpdateStatus('error', { message: err.message });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      log.info('Download progress:', progressObj);
      this.sendUpdateStatus('downloading', {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond,
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      log.info('Update downloaded:', info);
      this.updateDownloaded = true;
      this.sendUpdateStatus('downloaded', info);
      this.showUpdateReadyDialog(info);
    });
  }

  async checkForUpdates(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      log.info('Skipping update check in development mode');
      return;
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      log.info('Check for updates result:', result);
    } catch (error) {
      log.error('Failed to check for updates:', error);
      throw error;
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Failed to download update:', error);
      throw error;
    }
  }

  quitAndInstall(): void {
    if (!this.updateDownloaded) {
      log.warn('No update downloaded, cannot install');
      return;
    }

    autoUpdater.quitAndInstall(false, true);
  }

  private async showUpdateAvailableDialog(info: UpdateInfo): Promise<void> {
    if (!this.mainWindow) return;

    const { response } = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `EasyPod ${info.version} is available`,
      detail: info.releaseNotes || 'A new version is available. Would you like to download it now?',
      buttons: ['Download Now', 'Download Later', 'Skip This Version'],
      defaultId: 0,
      cancelId: 1,
    });

    switch (response) {
      case 0: // Download Now
        await this.downloadUpdate();
        break;
      case 1: // Download Later
        // 用户可以稍后手动下载
        break;
      case 2: // Skip This Version
        // 可以实现跳过特定版本的逻辑
        break;
    }
  }

  private async showUpdateReadyDialog(info: UpdateInfo): Promise<void> {
    if (!this.mainWindow) return;

    const { response } = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully',
      detail: `EasyPod ${info.version} has been downloaded and is ready to install. The application will restart to apply the update.`,
      buttons: ['Restart Now', 'Restart Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      this.quitAndInstall();
    }
  }

  private sendUpdateStatus(status: string, data?: any): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-status', { status, data });
    }
  }

  // 定期检查更新 (每6小时)
  startPeriodicCheck(): void {
    this.checkForUpdates(); // 立即检查一次

    setInterval(() => {
      this.checkForUpdates();
    }, 6 * 60 * 60 * 1000); // 6小时
  }
}

export default new UpdateService();
```

### CI/CD配置示例
```yaml
# .github/workflows/build.yml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-macos:
    runs-on: macos-latest

    env:
      CSC_IDENTITY_AUTO_DISCOVERY: true
      APPLE_ID: ${{ secrets.APPLE_ID }}
      APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
      APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Build application
      run: npm run build

    - name: Import Code-Signing Certificates
      uses: Apple-Actions/import-codesign-certs@v2
      with:
        p12-file-base64: ${{ secrets.CERTIFICATES_P12 }}
        p12-password: ${{ secrets.CERTIFICATES_P12_PASSWORD }}

    - name: Build and sign app
      run: npm run electron:build
      env:
        BUILD_VERSION: ${{ github.ref_name }}
        BUILD_NUMBER: ${{ github.run_number }}

    - name: Upload artifacts
      uses: actions/upload-artifact@v4
      with:
        name: macos-builds
        path: dist/*.{dmg,zip}

    - name: Create Release
      if: startsWith(github.ref, 'refs/tags/')
      uses: softprops/action-gh-release@v1
      with:
        files: |
          dist/*.dmg
          dist/*.zip
          dist/latest-mac.yml
        generate_release_notes: true
        prerelease: contains(github.ref, 'beta')
```

### 更新配置文件
```yaml
# build/app-update.yml
provider: github
owner: easypod
repo: easypod-releases
updaterCacheDirName: easypod-updater
private: true
publishAutoUpdate: true
```

## Package.json脚本配置
```json
{
  "scripts": {
    "electron:build": "node scripts/build.js",
    "electron:build:dev": "cross-env NODE_ENV=development electron-builder",
    "electron:sign": "electron-builder --publish=never",
    "electron:publish": "electron-builder --publish=always",
    "preelectron:build": "npm run build",
    "postinstall": "electron-builder install-app-deps"
  }
}
```

## 相关文件
- `electron-builder.config.js` - 构建配置
- `scripts/build.js` - 构建脚本
- `scripts/notarize.js` - 公证脚本
- `build/entitlements.mac.plist` - 权限配置
- `src/main/services/UpdateService.ts` - 更新服务
- `.github/workflows/build.yml` - CI/CD配置

## 后续任务依赖
- 完整MVP测试和发布
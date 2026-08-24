const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function runCommand(cmd, cwd) {
  console.log(`\nExecuting: ${cmd} (in ${cwd || __dirname})`);
  execSync(cmd, { stdio: 'inherit', cwd: cwd || __dirname });
}

async function verifyDatabase() {
  const dbPath = path.join(__dirname, 'base.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error(`❌ base.db not found at ${dbPath}.\nPlease run the dev server first so the database is populated.`);
  }
  const size = fs.statSync(dbPath).size;
  if (size < 1024) {
    throw new Error(`❌ base.db is too small (${size} bytes) — it appears to be empty or corrupted.\nPlease run the dev server and sync data from Supabase first.`);
  }

  // Use better-sqlite3 to verify employee count
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare("SELECT COUNT(*) as cnt FROM employees").get();
    db.close();
    const empCount = row ? row.cnt : 0;
    if (empCount === 0) {
      throw new Error(`❌ base.db has 0 employees. Cannot export — login would fail.\nPlease run the dev server and ensure employees are synced from Supabase first.`);
    }
    console.log(`✅ Database verified: ${empCount} employees found in base.db (${Math.round(size/1024)} KB)`);
  } catch (dbErr) {
    if (dbErr.message.startsWith('❌')) throw dbErr;
    console.warn(`⚠️  Could not verify employee count (${dbErr.message}), proceeding anyway...`);
  }
}

async function main() {

  try {
    // 0. Verify database has data before exporting (prevents login failures)
    console.log('\n=== Verifying database before export ===');
    await verifyDatabase();
    console.log('=====================================\n');

    // 1. Build the production React frontend and Express server
    runCommand('npm run build');

    // 2. Setup clean staging directory in system temp to isolate native rebuild
    const stagingDir = path.join(os.tmpdir(), 'wellbore-staging');
    if (fs.existsSync(stagingDir)) {
      console.log('Cleaning up existing staging directory...');
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    fs.mkdirSync(stagingDir);

    // Clean up win-unpacked to prevent EPERM locks during electron-builder extraction
    const winUnpackedDir = path.join(__dirname, 'build-desktop', 'win-unpacked');
    if (fs.existsSync(winUnpackedDir)) {
      try { fs.rmSync(winUnpackedDir, { recursive: true, force: true }); } catch (_) {}
    }

    // 3. Copy only compiled production assets
    console.log('Staging compiled files...');
    fs.cpSync(path.join(__dirname, 'dist'), path.join(stagingDir, 'dist'), { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'electron-main.cjs'), path.join(stagingDir, 'electron-main.cjs'));
    fs.copyFileSync(path.join(__dirname, 'wellborePro.ico'), path.join(stagingDir, 'wellborePro.ico'));

    // Copy seed base.db so the installed app has employee data on first launch
    const dbSrc = path.join(__dirname, 'base.db');
    if (fs.existsSync(dbSrc)) {
      fs.copyFileSync(dbSrc, path.join(stagingDir, 'base.db'));
      console.log(`  Copied: base.db (${Math.round(fs.statSync(dbSrc).size / 1024)} KB) — seed database bundled`);
    }
    if (fs.existsSync(path.join(__dirname, '.env.local'))) {
      fs.copyFileSync(path.join(__dirname, '.env.local'), path.join(stagingDir, '.env.local'));
    }
    if (fs.existsSync(path.join(__dirname, 'LICENSE.txt'))) {
      fs.copyFileSync(path.join(__dirname, 'LICENSE.txt'), path.join(stagingDir, 'LICENSE.txt'));
    }
    if (fs.existsSync(path.join(__dirname, 'installer.nsh'))) {
      fs.copyFileSync(path.join(__dirname, 'installer.nsh'), path.join(stagingDir, 'installer.nsh'));
    }

    const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const appVersion = rootPkg.version || '1.0.1';
    console.log(`Building Wellbore Schematic Pro executable version: v${appVersion}...`);

    // 4. Write staging package.json with description and author to eliminate warnings
    fs.writeFileSync(
      path.join(stagingDir, 'package.json'),
      JSON.stringify({
        name: 'wellbore-pro-staging',
        version: appVersion,
        description: 'Wellbore Schematic Pro',
        author: 'ENP',
        main: 'electron-main.cjs',
        dependencies: {
          'better-sqlite3': '^12.11.1'
        }
      }, null, 2)
    );

    // 5. Copy better-sqlite3 and its runtime deps into staging node_modules
    console.log('Copying better-sqlite3 and dependencies into staging node_modules...');
    const nmDest = path.join(stagingDir, 'node_modules');
    fs.mkdirSync(nmDest, { recursive: true });
    for (const pkg of ['better-sqlite3', 'bindings', 'file-uri-to-path']) {
      const src = path.join(__dirname, 'node_modules', pkg);
      if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(nmDest, pkg), { recursive: true });
        console.log(`  Copied: ${pkg}`);
      } else {
        console.warn(`  WARNING: ${pkg} not found in root node_modules!`);
      }
    }

    // 6. Delete the pre-compiled Node.js binary before rebuilding to force fresh rebuild
    const prebuiltNode = path.join(nmDest, 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
    if (fs.existsSync(prebuiltNode)) {
      fs.rmSync(prebuiltNode);
      console.log('Deleted pre-compiled better_sqlite3.node (ABI 127)...');
    }
    const prebuildDir = path.join(nmDest, 'better-sqlite3', 'prebuilds');
    if (fs.existsSync(prebuildDir)) {
      fs.rmSync(prebuildDir, { recursive: true, force: true });
      console.log('Deleted prebuilds/ directory...');
    }

    // Clean up any leftover .bak files in root better-sqlite3 build dir
    const rootReleaseDir = path.join(__dirname, 'node_modules', 'better-sqlite3', 'build', 'Release');
    if (fs.existsSync(rootReleaseDir)) {
      try {
        const files = fs.readdirSync(rootReleaseDir);
        for (const f of files) {
          if (f.endsWith('.bak')) {
            try { fs.rmSync(path.join(rootReleaseDir, f), { force: true }); } catch (_) {}
          }
        }
      } catch (_) {}
    }

    // Rebuild better-sqlite3 inside package-staging
    console.log('Rebuilding better-sqlite3 for Electron v33.4.4 (ABI 130) inside staging directory...');
    runCommand(`npx --package=@electron/rebuild electron-rebuild -f -v 33.4.4 --only better-sqlite3 --module-dir .`, stagingDir);

    // Verify rebuilding succeeded and binary was created
    if (!fs.existsSync(prebuiltNode)) {
      throw new Error(`Rebuild failed! Native binary better_sqlite3.node not created at ${prebuiltNode}`);
    }
    console.log('Rebuild verified! Native binary exists.');

    // Set environment variables for electron-builder code signing with Publisher: Mirage
    const pfxSrc = path.join(__dirname, 'mirage.pfx');
    if (fs.existsSync(pfxSrc)) {
      process.env.CSC_LINK = pfxSrc;
      process.env.CSC_KEY_PASSWORD = 'Mirage123!';
      console.log('  Digital code-signing certificate (mirage.pfx) enabled for Publisher: Mirage');
    }

    // 7. Write electron-builder config inside package-staging
    const ebConfig = {
      appId: 'com.wellbore.pro',
      productName: 'Wellbore Schematic Pro',
      copyright: 'Copyright © Mirage',
      npmRebuild: false,
      electronVersion: '33.4.4',
      directories: {
        app: '.',
        output: path.join(stagingDir, 'dist-out')
      },
      files: [
        'dist/**/*',
        'electron-main.cjs',
        'wellborePro.ico',
        '.env.local',
        'base.db',
        'node_modules/better-sqlite3/build/Release/**/*',
        'node_modules/better-sqlite3/lib/**/*',
        'node_modules/better-sqlite3/package.json',
        'node_modules/bindings/**/*',
        'node_modules/file-uri-to-path/**/*'
      ],
      asarUnpack: [
        'node_modules/better-sqlite3/build/Release/**/*',
        'base.db'
      ],
      asar: true,
      publish: [
        {
          provider: 'github',
          owner: 'HALIMOUVIC',
          repo: 'TT'
        }
      ],
      win: {
        icon: 'wellborePro.ico',
        executableName: 'WellboreSchematicPro',
        target: [
          { target: 'nsis', arch: ['x64'] }
        ]
      },
      nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        license: 'LICENSE.txt',
        include: 'installer.nsh',
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: 'Wellbore Schematic Pro',
        installerIcon: 'wellborePro.ico',
        uninstallerIcon: 'wellborePro.ico',
        uninstallDisplayName: 'Wellbore Schematic Pro (Mirage)',
        artifactName: `WellboreSchematicPro Setup v${appVersion}.\${ext}`,
        runAfterFinish: false
      }
    };

    const ebConfigPath = path.join(stagingDir, 'electron-builder.json');
    fs.writeFileSync(ebConfigPath, JSON.stringify(ebConfig, null, 2));

    // 8. Build NSIS installer entirely inside package-staging directory
    console.log('Building NSIS installer with electron-builder inside staging directory...');
    runCommand(`npx electron-builder --config electron-builder.json --win nsis`, stagingDir);

    // 9. Copy all built artifacts from staging dist-out -> build-desktop
    const finalDestDir = path.join(__dirname, 'build-desktop');
    if (!fs.existsSync(finalDestDir)) {
      fs.mkdirSync(finalDestDir, { recursive: true });
    }
    const distOutDir = path.join(stagingDir, 'dist-out');
    if (fs.existsSync(distOutDir)) {
      const outFiles = fs.readdirSync(distOutDir);
      for (const file of outFiles) {
        const srcPath = path.join(distOutDir, file);
        if (fs.statSync(srcPath).isFile() && file !== 'builder-debug.yml') {
          fs.copyFileSync(srcPath, path.join(finalDestDir, file));
          console.log(`  Output copied: ${file}`);
        }
      }
    }

    // 10. Compute and verify latest.yml for auto-updater
    const crypto = require('crypto');
    const exeName = `WellboreSchematicPro Setup v${appVersion}.exe`;
    const exePath = path.join(finalDestDir, exeName);
    if (fs.existsSync(exePath)) {
      const fileBuffer = fs.readFileSync(exePath);
      const sha512Base64 = crypto.createHash('sha512').update(fileBuffer).digest('base64');
      const latestYmlContent = `version: ${appVersion}\nfiles:\n  - url: ${exeName}\n    sha512: ${sha512Base64}\n    size: ${fileBuffer.length}\npath: ${exeName}\nsha512: ${sha512Base64}\nreleaseDate: '${new Date().toISOString()}'\n`;
      fs.writeFileSync(path.join(finalDestDir, 'latest.yml'), latestYmlContent);
      console.log(`\n✅ Generated latest.yml (version v${appVersion}, size: ${fileBuffer.length} bytes, sha512: ${sha512Base64.substring(0, 16)}...)`);
    }

    // 11. Cleanup
    console.log('Cleaning up temporary staging folder...');
    fs.rmSync(stagingDir, { recursive: true, force: true });

    console.log('\n==================================================');
    console.log(`SUCCESS: Version v${appVersion} generated in "build-desktop/"!`);
    console.log('Files created:');
    console.log(`  - ${exeName}`);
    console.log(`  - ${exeName}.blockmap`);
    console.log(`  - latest.yml`);
    console.log('==================================================');
  } catch (error) {
    console.error('\nBuild failed:', error.message);
    process.exit(1);
  }
}

main();

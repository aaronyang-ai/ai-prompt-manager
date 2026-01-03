#!/usr/bin/env node

/**
 * 版本号递增脚本
 * 支持 patch/minor/major 递增
 */

const fs = require('fs');
const path = require('path');

const bumpType = process.argv[2]; // patch, minor, major

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('\n❌ 错误: 必须指定递增类型 (patch/minor/major)');
  console.log('\n用法:');
  console.log('  node bump-version.js patch  # 1.2.0 → 1.2.1');
  console.log('  node bump-version.js minor  # 1.2.0 → 1.3.0');
  console.log('  node bump-version.js major  # 1.2.0 → 2.0.0\n');
  process.exit(1);
}

// 读取当前版本
const manifestPath = path.join(__dirname, '../manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const currentVersion = manifest.version;

// 解析版本号
const [major, minor, patch] = currentVersion.split('.').map(Number);

// 计算新版本号
let newVersion;
switch (bumpType) {
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
}

console.log('\n📦 版本号递增');
console.log('=============\n');
console.log(`当前版本: ${currentVersion}`);
console.log(`新版本:   ${newVersion}`);
console.log(`递增类型: ${bumpType}\n`);

// 确认
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('确认更新版本号? (y/n): ', (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('\n❌ 已取消\n');
    rl.close();
    process.exit(0);
  }

  // 更新manifest.json
  manifest.version = newVersion;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n✅ manifest.json 已更新为 ${newVersion}`);

  // 提示运行同步脚本
  console.log('\n💡 下一步：运行以下命令同步版本号到其他文件');
  console.log('   npm run sync-version\n');

  rl.close();
});

#!/usr/bin/env node

/**
 * 版本号同步脚本
 * 从 manifest.json 同步版本号到其他文件
 */

const fs = require('fs');
const path = require('path');

// 读取manifest.json版本号（唯一真实来源）
const manifestPath = path.join(__dirname, '../manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version;

console.log('\n🔄 版本号同步');
console.log('=============\n');
console.log(`📌 基准版本（manifest.json）: ${version}\n`);

// 同步package.json
console.log('正在同步 package.json...');
const packagePath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.version = version;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
console.log(`✅ package.json 已更新为 ${version}`);

// 同步CLAUDE.md
console.log('\n正在同步 CLAUDE.md...');
const claudePath = path.join(__dirname, '../CLAUDE.md');
let claudeContent = fs.readFileSync(claudePath, 'utf8');
claudeContent = claudeContent.replace(
  /版本:\s*v\d+\.\d+\.\d+/,
  `版本: v${version}`
);
fs.writeFileSync(claudePath, claudeContent);
console.log(`✅ CLAUDE.md 已更新为 v${version}`);

console.log('\n' + '='.repeat(50));
console.log('\n⚠️  请手动更新以下文件的版本历史：');
console.log('   - README.md (找到 "### v*.*.* (当前版本)" 部分)');
console.log('   - README_EN.md (找到 "### v*.*.* (Current Version)" 部分)');
console.log('\n💡 步骤：');
console.log('   1. 在版本历史部分添加新版本 v' + version);
console.log('   2. 将之前的"当前版本"标记移除');
console.log('   3. 添加本次更新的变更日志\n');
console.log('✅ 自动同步完成！\n');

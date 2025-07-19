const { src, dest, series, parallel } = require('gulp');
const typescript = require('gulp-typescript');
const del = require('del');

// TypeScript project
const tsProject = typescript.createProject('tsconfig.json');

// Clean dist directory
function clean() {
  return del(['dist/**/*']);
}

// Compile TypeScript
function compileTS() {
  return tsProject.src().pipe(tsProject()).js.pipe(dest('dist'));
}

// Copy assets (icons, JSON files)
function copyAssets() {
  return src(['src/**/*.{png,svg,json}']).pipe(dest('dist'));
}

// Copy package.json
function copyPackageJson() {
  return src('package.json').pipe(dest('dist'));
}

// Build task
const build = series(clean, parallel(compileTS, copyAssets, copyPackageJson));

// Default task
exports.default = build;
exports.build = build;
exports.clean = clean;

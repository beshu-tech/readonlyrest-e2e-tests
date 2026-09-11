const Module = require('node:module');

const originalResolveFilename = Module._resolveFilename;
const typescriptPackageName = 'typescript';
const legacyApiPackageName = 'typescript-legacy-api';

Module._resolveFilename = function resolveTypeScriptLegacyApi(request, parent, isMain, options) {
  if (request === typescriptPackageName || request.startsWith(`${typescriptPackageName}/`)) {
    const legacyRequest = `${legacyApiPackageName}${request.slice(typescriptPackageName.length)}`;
    return originalResolveFilename.call(this, legacyRequest, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

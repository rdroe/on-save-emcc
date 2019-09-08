'use babel';

import {existsSync, readFileSync} from 'fs';
import {join, relative, dirname, extname} from 'path';
import {exec} from 'child_process';
import {CompositeDisposable} from 'atom';
import minimatch from 'minimatch';
import mkdirp from 'mkdirp';

const CONFIGS_FILENAME = '.on-save.json';
const EXEC_TIMEOUT = 60 * 1000; // 1 minute

export default {
  activate() {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.workspace.observeTextEditors(textEditor => {
      this.subscriptions.add(textEditor.onDidSave(this.handleDidSave.bind(this)));
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  handleDidSave(event) {
    let savedFile = event.path;
    const savedFileDir = dirname(savedFile);
    const rootDir = this.findRootDir(savedFileDir);
    if (!rootDir) {
      return;
    }
    savedFile = relative(rootDir, savedFile);
    const configs = this.loadConfigs(rootDir);
    for (const config of configs) {
      this.run({rootDir, config, savedFile});
    }
  },

  findRootDir(dir) {
    if (existsSync(join(dir, CONFIGS_FILENAME))) {
      return dir;
    }
    const parentDir = join(dir, '..');
    if (parentDir === dir) {
      return undefined;
    }
    return this.findRootDir(parentDir);
  },

  loadConfigs(rootDir) {
    const configsFile = join(rootDir, CONFIGS_FILENAME);
    let configs = readFileSync(configsFile, 'utf8');
    configs = JSON.parse(configs);
    if (!Array.isArray(configs)) {
      configs = [configs];
    }
    configs = configs.map(config => this.normalizeConfig(config));
    return configs;
  },

  normalizeConfig(config) {

    if (!config.files) {
      throw new Error('on-save: \'files\' property is missing in \'.on-save.json\' configuration file');
    }
    if (!Array.isArray(config.files)) {
      config.files = [config.files];
    }
    if (!config.command) {
      throw new Error('on-save: \'command\' property is missing in \'.on-save.json\' configuration file');
    }
    if (!config.srcDir) {
      config.srcDir = '';
    }
    if (!config.destDir) {
      config.destDir = config.srcDir;
    }
    if (config.showOutput === undefined) {
      config.showOutput = false;
    }
    if (config.showError === undefined) {
      config.showError = true;
    }

    return {...config, files: config.files};
  },

  run({rootDir, savedFile, config}) {
    const matched = config.files.find(glob => {
      glob = join(config.srcDir, glob);
      return minimatch(savedFile, glob);
    });
    if (!matched) {
      return;
    }

    let destFile = relative(config.srcDir, savedFile);
    destFile = join(config.destDir, destFile);

    const exportNames = this.getExportedFunctions([savedFile], rootDir).map(f => `"_${f}"`);
    const exportedFunctions = exportNames.join(',');
    const srcFile = savedFile;
    const extension = extname(destFile);
    const destFileWithoutExtension = destFile.substr(0, destFile.length - extension.length);

    mkdirp.sync(join(rootDir, dirname(destFile)));

    const command = this.resolveVariables(config.command, {
      srcFile,
      destFile,
      destFileWithoutExtension,
      exportedFunctions,
    });

    const options = {cwd: rootDir, timeout: EXEC_TIMEOUT};

    exec(command, options, (err, stdout, stderr) => {
      const message = 'on-save';

      const output = stdout.trim();
      if (config.showOutput && output) {
        atom.notifications.addSuccess(message, {detail: output, dismissable: true});
      }

      const error = stderr.trim() || (err && err.message);
      if (config.showError && error) {
        atom.notifications.addError(message, {detail: error, dismissable: true});
      }
    });
  },

  resolveVariables(command, vars) {
    for (const key of Object.keys(vars)) {
      const value = vars[key];
      const regExp = new RegExp(`\\$\\{${key}\\}`, 'g');
      command = command.replace(regExp, value);
    }
    return command;
  },

  getExportedFunctions(sources, rootDir) {
    return sources.reduce((accum, fname) => {
      const fNameResolved= join(rootDir, fname);
      const content = readFileSync(fNameResolved, 'utf8');
      const mtch = content.match(/\w*(?=\s\/\*f\*\/)/g);
      return accum.concat(mtch.filter(m => !!m))
    }, []);
  }
};

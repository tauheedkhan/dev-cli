"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const command_1 = require("@oclif/command");
const path = require("path");
const qq = require("qqjs");
const Tarballs = require("../../tarballs");
const scripts = {
    preinstall: (config) => `#!/usr/bin/env bash
sudo rm -rf /usr/local/lib/${config.dirname}
sudo rm -rf /usr/local/${config.bin}
sudo rm -rf /usr/local/bin/${config.bin}
`,
    postinstall: (config) => `#!/usr/bin/env bash
set -x
sudo mkdir -p /usr/local/bin
sudo ln -sf /usr/local/lib/${config.dirname}/bin/${config.bin} /usr/local/bin/${config.bin}
if which node > /dev/null
then
    echo "node is installed, skipping..."
else
    sudo ln -sf /usr/local/lib/${config.dirname}/node-v${config.nodeVersion}-${config.platform}-${config.arch}/bin/node /usr/local/bin/node
    sudo ln -sf /usr/local/lib/${config.dirname}/node-v${config.nodeVersion}-${config.platform}-${config.arch}/bin/npm /usr/local/bin/npm
fi
`,
};
class PackMacos extends command_1.Command {
    async run() {
        if (process.platform !== 'darwin')
            this.error('must be run from macos');
        const { flags } = this.parse(PackMacos);
        const buildConfig = await Tarballs.buildConfig(flags.root);
        let { config } = buildConfig;
        config.nodeVersion = buildConfig.nodeVersion
        const c = config.pjson.oclif;
        if (!c.macos || !c.macos.identifier)
            this.error('package.json must have oclif.macos.identifier set');
        await Tarballs.build(buildConfig, { platform: 'darwin', pack: false });
        const dist = buildConfig.dist(`macos/${config.bin}-v${buildConfig.version}.pkg`);
        await qq.emptyDir(path.dirname(dist));
        const scriptsDir = qq.join(buildConfig.tmp, 'macos/scripts');
        const writeScript = async (script) => {
            const path = [scriptsDir, script];
            await qq.write(path, scripts[script](config));
            await qq.chmod(path, 0o755);
        };
        await writeScript('preinstall');
        await writeScript('postinstall');
        const nodeExecutablePath = `${buildConfig.root}/tmp/node/node-v${buildConfig.nodeVersion}-${buildConfig.config.platform}-${buildConfig.config.arch}`;
        await qq.cp(nodeExecutablePath, buildConfig.workspace({ platform: 'darwin', arch: 'x64' }));
        /* eslint-disable array-element-newline */
        const args = [
            '--root', buildConfig.workspace({ platform: 'darwin', arch: 'x64' }),
            '--identifier', c.macos.identifier,
            '--version', buildConfig.version,
            '--install-location', `/usr/local/lib/${config.dirname}`,
            '--scripts', scriptsDir,
        ];
        /* eslint-enable array-element-newline */
        if (c.macos.sign)
            args.push('--sign', c.macos.sign);
        if (process.env.OSX_KEYCHAIN)
            args.push('--keychain', process.env.OSX_KEYCHAIN);
        args.push(dist);
        await qq.x('pkgbuild', args);
    }
}
exports.default = PackMacos;
PackMacos.description = 'pack CLI into MacOS .pkg';
PackMacos.flags = {
    root: command_1.flags.string({ char: 'r', description: 'path to oclif CLI root', default: '.', required: true }),
};

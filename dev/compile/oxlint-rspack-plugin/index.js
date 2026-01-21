const { spawnSync } = require("child_process");

const OXLINT_PLUGIN = "OxLintWebpackPlugin";
const CHILD_PROCESS_MAX_FILES = 10;
// Unicode Character “⠀” (U+2800)
// @see https://www.compart.com/en/unicode/U+2800
const BLANK_SPACE = "⠀";

let counter = 0;

class OxLintWebpackPlugin {
  constructor({
    format = "default",
    childProcessMaxFiles = CHILD_PROCESS_MAX_FILES,
  } = {}) {
    this.key = OXLINT_PLUGIN;
    this.format = format;
    this.childProcessMaxFiles = childProcessMaxFiles;
    this.context = undefined;
  }

  apply(compiler) {
    // Generate key for each compilation,
    // this differentiates one from the other when being cached.
    this.key = compiler.name || `${this.key}_${(counter += 1)}`;
    this.context = compiler.options.context;

    compiler.hooks.run.tap(this.key, (c) => this.run(c));
    compiler.hooks.watchRun.tap(this.key, (c) => this.run(c));
  }

  run(compiler) {
    // Do not re-hook
    if (
      compiler.hooks.thisCompilation.taps.find(({ name }) => name === this.key)
    ) {
      return;
    }

    compiler.hooks.thisCompilation.tap(this.key, (compilation) => {
      const files = [];

      // Add the file to be linted
      compilation.hooks.succeedModule.tap(this.key, ({ resource }) => {
        if (resource) {
          const [file] = resource.split("?");
          files.push(file);
        }
      });

      // Lint all files added
      compilation.hooks.finishModules.tapPromise(this.key, async () => {
        if (files.length > 0) {
          const args = files.length > this.childProcessMaxFiles ? [] : files;
          const linterOutput = this.executeLinter(args);
          if (linterOutput) {
            const { warnings, errors } = this.processOutput(linterOutput);
            warnings.forEach((warning) => compilation.warnings.push(warning));
            errors.forEach((error) => compilation.errors.push(error));
          }
        }
      });
    });
  }

  executeLinter(args) {
    const lintProcess = spawnSync("oxlint", ["-f", this.format, ...args], {
      cwd: this.context,
      env: {
        FORCE_COLOR: 1,
        ...process.env,
      },
    });

    if (lintProcess.error) {
      throw new Error(lintProcess.error);
    }

    return lintProcess.stdout?.toString();
  }

  processOutput(output) {
    const groups = [];
    let group;
    // Warnings and errors are separated by blank lines.
    const lines = output.split("\n");
    for (let i = 0, n = lines.length; i < n; i += 1) {
      const line = lines[i];
      const isBlankLine = line.trim() === "";
      if (isBlankLine) {
        // Save previous group if present.
        if (group) {
          groups.push(group);
        }
        // Create a new group
        group = [];
      } else {
        if(!group) group = [];
        group.push(line);
      }
    }

    return this.format === "stylish"
      ? this.processStylishFormat(groups)
      : this.constructor.processDefaultFormat(groups);
  }

  static processDefaultFormat(groups) {
    const results = { warnings: [], errors: [] };

    for (let i = 0, n = groups.length; i < n; i += 1) {
      const group = groups[i];
      const groupFirstLine = group[0];
      if (groupFirstLine.includes("⚠")) {
        results.warnings.push(`\n${group.join("\n")}`);
      }
      if (groupFirstLine.includes("×")) {
        results.errors.push(`\n${group.join("\n")}`);
      }
    }

    return results;
  }

  processStylishFormat(groups) {
    const results = { warnings: [], errors: [] };
    for (let i = 0, n = groups.length; i < n; i += 1) {
      const group = groups[i];

      // Shorten file path
      group[0] = group[0].replace(`${this.context}/`, "");

      // Check lines for the presence of warnings or errors.
      let groupHasWarnings = false;
      let groupHasErrors = false;

      // Skip first line, which is the file path.
      for (let x = 1, l = group.length; x < l; x += 1) {
        const line = group[x];
        const lineParts = line.split("  ");
        if (lineParts[2].includes("warning")) {
          groupHasWarnings = true;
        }
        if (lineParts[2].includes("error")) {
          groupHasErrors = true;
        }
      }

      // Add a blank space to warnings and errors to make they render
      // in a new line, so hyperlinks work.
      const groupString = `${BLANK_SPACE}\n${group.join("\n")}`;
      if (groupHasErrors) {
        results.errors.push(groupString);
      } else if (groupHasWarnings) {
        results.warnings.push(groupString);
      }
    }

    return results;
  }
}

module.exports = { OxLintWebpackPlugin };

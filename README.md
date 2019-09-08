For users of emcc, who compile C or C++ to Wasm, this package enables automated creation of an EXPORTED_FUNCTIONS list. You manually mark the desired exports with `/*f*/`. They become available in the automatically run script.

`'-s EXPORTED_FUNCTIONS=...'` is required in many cases where you want to call C or C++ from JS.  

Originally forked from https://github.com/mvila/on-save.
Thanks, for making it easily hackable, mvila.

## Installation
For now, at least, install using this git repo.
```
apm install git@github.com:rdroe/on-save-emcc.git
```

## Usage

Create an `.on-save.json` file at the root of your project (or anywhere in the path of the files you want to watch). Since this fork is focused on emscripten, I presume you will be configuring a CLI call to the emcc / em++ compiler.

As regular users of Emscripten to generate wasm know, any C++ function that you want to be callable from JS must be added (with a prefixed underscore) to the "EXPORTED_FUNCTIONS" flag argument.

With emcc, you can use the `-s EXPORT_ALL=1` flag, but you may want more precision.

For example, if you want to export the `main` function from C++ (which is in fact required if you want that function to run), you would place the marker after its name in its definition, e.g.

```
int main /*f*/ () {
  // code
}
```

After so marking exportable functions, you can use `${exportedFunctions}` like other template properties in the `command` property of the configs:

```json
[
  {
    "srcFile": "main.cpp",
    "destDir": "build",
    "outFile": "app.html",
    "showOutput": true,
    "files": ["**/*.cpp", "**/*.html", "**/*.hpp"],
    "command": "emcc tests/hello_function.cpp -o function.html -s EXPORTED_FUNCTIONS='[${exportedFunctions}]'"
  }
]
```

The `/*f*/` marked functions will show up in a comma-separated list in the `${exportedFunctions}` template area. They will be preceded by an underscore.

## Configuration file

The content of the `.on-save.json` file must be an array of objects with the following properties:

* `srcDir` _(default to `.on-save.json`'s directory)_: The source directory.
* `destDir` _(default to `srcDir`)_: The destination directory.
* `files`: The files you want to track. You can use a glob (see [minimatch](https://github.com/isaacs/minimatch)), or an array of globs.
* `command`: The command to execute. You can use these variables:
  * `${srcFile}`: The input file.
  * `${destFile}`: The output file.
  * `${destFileWithoutExtension}`: The output file without the extension.
  * `${exportedFunctions}`: Emcc's "-s EXPORTED_FUNCTIONS" value; see example.
* `showOutput` _(default to `false`)_: A boolean indicating whether the output stream (stdout) should be displayed or not.
* `showError` _(default to `true`)_: A boolean indicating whether the error stream (stderr) should be displayed or not.

## License

MIT

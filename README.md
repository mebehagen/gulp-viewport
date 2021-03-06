# gulp-viewport

[![](https://img.shields.io/npm/v/gulp-viewport.svg)](https://www.npmjs.com/package/gulp-viewport) [![](https://img.shields.io/npm/dt/gulp-viewport.svg)](https://www.npmjs.com/package/gulp-viewport) [![](https://img.shields.io/twitter/follow/k15tsoftware.svg?style=social&label=Follow)](https://twitter.com/k15tsoftware)

<!-- toc orderedList:0 depthFrom:2 depthTo:6 -->

* [Install](#install)
* [Get started](#get-started)
    * [Upload all files in a pipeline](#upload-all-files-in-a-pipeline)
    * [Upload preprocessed files](#upload-preprocessed-files)
    * [Set-up BrowserSync](#set-up-browsersync)
    * [Delete all files from theme](#delete-all-files-from-theme)
    * [Example gulpfile.js](#example-gulpfilejs)
* [Using gulp without a .viewportrc for CI server](#using-gulp-without-a-viewportrc-for-ci-server)
* [Workaround for Windows if theme could not get load](#Workaround-for-windows-if-theme-could-not-get-load)
* [Known Limitations](#known-limitations)
* [Resources & Further Reading](#resources-further-reading)
* [Licensing](#licensing)

<!-- tocstop -->

The Gulp plugin for Scroll Viewport uploads theme resources directly into Scroll Viewport.

This is useful, when developing a Scroll Viewport theme in a local IDE. In this case, a Gulp file can watch the resources, automatically upload the resources to Scroll Viewport, and even have for example BrowserSync to sync the browser.

Looking for the old version documentation? [See readme for 1.2.0](https://github.com/K15t/gulp-viewport/blob/ba1c5bb0ff4d3b938ecca37e017c21bb833867a3/README.md).

## Install

Install gulp-viewport as dev devepency
```
npm i -D gulp gulp-viewport
```

## Get started

If you want to just get started with a working example, clone the repository and head to the [example](example).

```sh
git clone git@github.com:K15t/gulp-viewport.git
cd gulp-viewport/example
npm install
// change settings to match your username, password, confluence url and theme name
gulp upload
```

For further professional usage, please continue with the instructions below.
Create a config file in your home directory called `.viewportrc`. This contains a list of all systems to which you want to upload your themes.

```yaml
[DEV]
confluenceBaseUrl=http://localhost:1990/confluence
username=admin
password=admin
```

Each section in the file is represents a Confluence server, also called **target system**.
In the example above there is one target system called **DEV**.

Then you can use the Gulp Viewport plugin in your gulp file like the following:

```js
var ViewportTheme = require('gulp-viewport');

var viewportTheme = new ViewportTheme({
    themeName: 'your-theme',
    // target system
    env: 'DEV'
});
```

Below is the full list of configuration options:

```js
var viewportTheme = new ViewportTheme({
    // name of the theme to upload to
    themeName: 'your-theme-name',
    // If you want to use space admin permissions instead of global, set the space key here
    scope: ,
    // For home-config users of .viewportrc - defines which config to use for target
    env: 'DEV',
    // If you want to set up your target via the gulpfile instead of a .viewportrc, use this.
    // Notice that you should NOT check in your credentials with git!
    // omit env, if you are using target.
    target: {
        // https://your-installation.com/confluence/
        confluenceBaseUrl: ,
        // A user that is eligible to update viewport themes in the given space
        username: ,
        password: ,
    },
    // If the source is placed in a subfolder (dist/theme/...) use this path
    sourceBase: ,
    // If the source has to be placed somewhere else than /
    targetPath: ,
});
```

### Targeting multiple themes and spaces

You may be deploying the theme to a test development and a production instance on the same server, or you may use different spaces to test changes. You can also include themeName and scope in the `.viewportrc` file to further specify the target system:

```yaml
[DEV]
confluenceBaseUrl=http://localhost:1990/confluence
themeName=Twenty-Sixteen-Dev
scope=VPRTDOCDEV
username=admin
password=admin

[PROD]
confluenceBaseUrl=http://localhost:1990/confluence
themeName=Twenty-Sixteen 
scope=VPRTDOC
username=admin
password=admin

```

In the example above there are two target systems called **DEV** and **PROD**. Then you can use the Gulp Viewport plugin in your gulp file along with a command line parameter:

```js
var ViewportTheme = require('gulp-viewport');
var minimist = require('minimist');

var knownOptions = {
  string: 'env',
  default: { env: process.env.VPRT_ENV || 'DEV' }
};

var options = minimist(process.argv.slice(2), knownOptions);

var viewportTheme = new ViewportTheme({
    env: options.env
});
```

Then you can pass the parameter on the gulp command line to specify the target system, or omit it to fallback to an environment variable or the default value:

```
gulp --env PROD
```

### sourceBase & targetPath

These two settings are special, as they give you control over where the source comes from, and where it belongs to.

**Example with single file**
We want to preprocess `src/less/main.less` and upload it to `css/main.css`
The setting would have to be the following:
```js
gulp.task('less', function () {
    return gulp.src('src/less/main.less')
        .pipe(gulpSourcemaps.init())
        .pipe(gulpLess())
        .pipe(minifyCss())
        .pipe(gulp.dest('build/css'))
        .pipe(viewportTheme.upload(
            {
                sourceBase: 'build/css/main.css',
                targetPath: 'css/main.css'
            }
        ))
});
```

In this case, we change paths, so we have to set a new sourceBase.
If we just want different folders, but keep the extension and filename, you will use it like this:

**Example with multiple files**
Templates are in `src/main_theme/templates` and we want to upload to `/`

```js
gulp.task('less', function () {
    return gulp.src('src/main_theme/templates/**/*.vm')
        .pipe(viewportTheme.upload(
            {
                sourceBase: 'src/main_theme/templates',
            }
        ))
});
```

This rebases the path for all uploaded files to `/`. In this case, all uploaded files have `src/main_theme/templates` removed.

So with these two options, you can remove or extend the path.

### Upload all files in a pipeline

The gulp-viewport plugin provides a special destination, that uploads a files in the pipeline to a target (that has been defined in the `~/.viewportrc` file).

```js
gulp.task('templates', function () {
    return gulp.src('assets/**/*.vm')
        .pipe(viewportTheme.upload());    // upload to viewport theme
});
```

`viewportTheme.upload()` accepts options that can temporarily override the options for the upload. This is useful for setting `sourceBase` and `targetPath` on demand. **Note:** the options are reset to the initial ones, after each upload.

### Upload preprocessed files

Especially CSS and JS files usually need some batching, minification and other pre-processing.
Here is how to do it.

```js
gulp.task('less', function () {
    return gulp.src('assets/less/main.less')
        .pipe(gulpSourcemaps.init())
        .pipe(gulpLess())
        .pipe(minifyCss())
        .pipe(viewportTheme.upload({
            targetPath: 'css/main.css'    // target destination of batched file
        }));
});
```

### Set-up BrowserSync

For development gulp-watch and BrowserSync is super handy.

To set up gulp-watch and BrowserSync:
```js
// Dependencies
var browserSync = require('browser-sync').create();
// [...]
var ViewportTheme = require('gulp-viewport');


var viewportTheme = new ViewportTheme({
    themeName: 'theme-name',
    // The target system needs to match with a section in .viewportrc
    env: 'DEV',
    sourceBase: 'assets'
});

gulp.task('watch', function () {

    // init browser sync.
    browserSync.init({
        open: false,
        // the target needs to define a viewportUrl
        proxy: 'http://localhost:1990/confluence',
    });

    // Override the UPLOAD_OPTS to enable auto reload.
    viewportTheme.on('uploaded', browserSync.reload);

    gulp.watch('assets/less/**.less', ['less']);
    gulp.watch('assets/**/*.vm', ['templates']);
    // ... create more watches for other file types here
});
```

### Delete all files from theme
```js
gulp.task('reset-theme', function () {
    viewportTheme.removeAllResources();
});
```

### Example gulpfile.js

Checkout [example/gulpfile.js](example/gulpfile.js) for a full example gulpfile.
To use the example, you need to install the following dependencies:

```
npm i -S browser-sync clone extend gulp-less gulp-minify-css gulp-sourcemaps
```

## Using gulp without a .viewportrc for a CI server

For tools like Bitbucket pipelines, where you can't rely on a file `.viewportrc` sitting in your home, or need automated builds on a CI server, you can use the following `process.env` variables:

* VPRT_THEMENAME - `themeName`
* VPRT_THEMEID - `themeId`
* VPRT_SCOPE - `scope`
* VPRT_ENV - `env`
* VPRT_CONFLUENCEBASEURL - `target.confluenceBaseUrl`
* VPRT_USERNAME - `target.username`
* VPRT_PASSWORD - `target.password`
* VPRT_SOURCEBASE - `sourceBase`
* VPRT_TARGETPATH - `targetPath`

Same with the config for the gulpfile: you can omit `env` if you use `user`, `password` and `url`.

```
VPRT_THEMENAME=my-theme VPRT_USERNAME=user VPRT_PASSWORD=secret VPRT_CONFLUENCEBASEURL=https://your-confluence-installation.com gulp upload
```

Checkout [example/gulpfile.js](example/gulpfile.js) for a full example gulpfile. This example assumes theme source is found in a
src/ subdirectory. To start from an existing theme, download the theme jar and unpack into src/, e.g.:

```sh
cd example
mkdir src/
unzip -d src/ /tmp/scroll-webhelp-theme-2.4.3.jar
```

## Workaround for Windows if theme could not get load

If you want to open you theme in the theme editor in confluence and get an error "Loading failed: Could not load theme" and you work with OS Windows please follow these steps.

* install this plugin https://www.npmjs.com/package/slash
* surround the calls to path.relative inside the index.js file with slash()
* try uploading your theme again.

Cause:
when running the plugin on a Windows machine, the path plugin used to create relative path-names generates backslashes in the path instead of the expected slashes (see [https://nodejs.org/docs/latest/api/path.html]).

## Known Limitations

* Please make sure you have Scroll Viewport 2.7.1 or later installed, the Gulp plugin will not work with any version before that. If you look to support an older version, please install version 1.2.0 of the plugin ([See readme 1.2.0]((https://github.com/K15t/gulp-viewport/blob/ba1c5bb0ff4d3b938ecca37e017c21bb833867a3/README.md))).
* When using `gulp-watch`, files that are deleted or moved locally, will not automatically be deleted or moved in Confluence. In order to reset a theme use `viewportTheme.removeAllResources()` to remove all files and then upload all files from scratch.


## Resources & Further Reading

The following resources have been used when creating the plugin:

* A general starter on Gulp plugins: https://github.com/gulpjs/gulp/blob/master/docs/writing-a-plugin/guidelines.md
* For the API of the file objects used here: https://github.com/wearefractal/vinyl


## Licensing

MIT

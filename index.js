"use strict"

var fs = require('fs')
var gutil = require('gulp-util')
var homeConfig = require('home-config')
var path = require('path')
var request = require('request')
var syncRequest = require('sync-request')
var strformat = require('strformat')
var through = require("through2")
var observable = require("riot-observable")

const PLUGIN_NAME = 'gulp-viewport'
const VIEWPORTRC = homeConfig.load('.viewportrc')

const THEME_BY_NAME_REST_URL = '/rest/scroll-viewport/1.0/theme?name={0}&scope={1}'
const UPDATE_REST_URL = '/rest/scroll-viewport/1.0/theme/{0}/resource'
const DELETE_REST_URL = '/rest/scroll-viewport/1.0/theme/{0}/resource'

module.exports = class ViewportTheme {
    constructor(options) {

        // allow events to be triggered and listened to
        observable(this)

        // Options are set via ENV variables, GULP Config and/or .viewportrc config
        const defaultOptions = {
            // If not existing, determine key using the id. one of the two has to exist
            themeName: process.env.VPRT_THEMENAME,
            // It is usually easier to use the themeName, but if needed - the id can be used.
            themeId: process.env.VPRT_THEMEID,
            // For home-config users of .viewportrc - defines which config to use for target
            env: process.env.VPRT_ENV,
            // If you want to use space admin permissions instead of global, set the space key here
            scope: process.env.VPRT_SCOPE,
            // If you do not want to use a .viewportrc file, you can manually pass the target opts
            target: {
                // https://your-installation.com/confluence/
                confluenceBaseUrl: process.env.VPRT_CONFLUENCEBASEURL,
                // A user that is eligible to update viewport themes in the given space
                username: process.env.VPRT_USERNAME,
                password: process.env.VPRT_PASSWORD,
            },
            // If the source is placed in a subfolder (dist/theme/...) use this path
            sourceBase: process.env.VPRT_SOURCEBASE,
            // If the source has to be placed somewhere else than /
            targetPath: process.env.VPRT_TARGETPATH,
        }

        this.options = defaultOptions
        this.options = this.extendOptions(options)

        this.log(`${this.getUserAnnotation()} Changing theme ${gutil.colors.bold.red(this.options.themeName)} at ${gutil.colors.bold.green(this.options.target.confluenceBaseUrl)}`)
    }

    getUserAnnotation() {
        if (this.options.env) {
            return `[${gutil.colors.red.bold(this.options.target.username)}@${this.options.env}]`
        } else if (this.options.target.confluenceBaseUrl) {
            return `[${gutil.colors.red.bold(this.options.target.username)}]`
        }
    }

    extendOptions(options = {}) {
        var newOptions = {target:{}}
        if (options) {
            Object.assign(newOptions, this.options, options)
            if (options.target) {
                Object.assign(newOptions.target, this.options.target, options.target)
            }
            return this.validateOptions(newOptions)
        }
    }

    validateOptions(options) {
        if (options.env && VIEWPORTRC.hasOwnProperty(options.env)) {
            options.target = Object.assign({}, options.target, VIEWPORTRC[options.env])
        }
        if (!options.targetPath) {
            options.targetPath = './'
        }
        if (!options.sourceBase) {
            options.sourceBase = './'
        }
        if (!options.scope) {
            if (!options.target.scope) {
                options.scope = ''
            } else {
                options.scope = options.target.scope
            }
        }
        if (!options.themeId) {
            if (!options.themeName) {
                if (!options.target.themeName) {
                    throw new gutil.PluginError(PLUGIN_NAME, 'themeName or themeId missing')
                } else {
                    options.themeName = options.target.themeName
                    options.themeId = this.getThemeId(options)
                }
            } else {
                options.themeId = this.getThemeId(options)
            }
        }
        return options
    }

    getThemeId(options) {
        var response = syncRequest('GET', strformat(options.target.confluenceBaseUrl + THEME_BY_NAME_REST_URL, options.themeName, options.scope),
            {
                headers: {
                    'Authorization': ('Basic ' + new Buffer(options.target.username + ':' + options.target.password).toString('base64'))
                }
            }
        )

        if (response.statusCode != 200) {
            console.log(response.statusCode + ' - ' + response.statusMessage)
            if (response.statusCode == 401 || response.statusCode == 403) {
                throw new gutil.PluginError(PLUGIN_NAME, 'Authentication for '+options.target.username+' failed!')
            } else {

            throw new gutil.PluginError(PLUGIN_NAME, 'Theme \'' + options.themeName + '\' not found on \'' + options.target.confluenceBaseUrl +
                '\'! Create a new theme named exactly like this to fix.')
            }
        }

        return JSON.parse(response.getBody('utf8')).id
    }

    log(message) {
        // if we use the default console.log, objects and arrays are displayed nicely (though, wihout [plugin-name] branding)
        // we have this function, so we can still change it to our liking
        console.log(message)
    }

    error(message) {
        // if we use the default console.log, objects and arrays are displayed nicely (though, wihout [plugin-name] branding)
        // we have this function, so we can still change it to our liking
        console.error(message)
    }

    upload(options) {
        options = this.extendOptions(options)
        this.trigger('upload')
        let filesToUpload = []
        return through.obj(
            (file, enc, cb) => {
                // If file exists, add it to our queue
                if (!file.isNull()) {
                    let sourceBase = path.relative(options.sourceBase, file.history[0])
                    let relativeSourceFilePath = path.relative(process.cwd(), file.history[0])
                    let sourceBasedFilePath = path.relative(options.sourceBase, relativeSourceFilePath)
                    let targetPathFilePath = path.relative(options.targetPath, sourceBasedFilePath)
                    let targetPathStart = path.relative(process.cwd(), options.targetPath)

                    if (options.targetPath.match(/\.\w+?$/)) {
                        var targetPath = targetPathStart
                    } else {
                        var targetPath = targetPathFilePath
                    }

                    if (options.sourceBase.match(/\.\w+?$/)) {
                        var sourceBasePath = options.sourceBase
                    } else {
                        var sourceBasePath = relativeSourceFilePath
                    }

                    filesToUpload.push(
                        {
                            path: targetPath,
                            file: fs.createReadStream(sourceBasePath)
                        }
                    )
                }
                cb(null, file)
            },
            (cb) => {
                let files = filesToUpload.map(item=>item.file)
                let locations = filesToUpload.map(item=>item.path)
                request({
                    url: strformat(options.target.confluenceBaseUrl + UPDATE_REST_URL, options.themeId),
                    method: 'POST',
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'Authorization': ('Basic ' + new Buffer(options.target.username + ':' + options.target.password).toString('base64'))
                    },
                    formData: { files, locations }
                }, (error, response) => {
                    if (error) {
                        console.log(error);
                        return
                    }
                    if (response.statusCode === 201) {
                        let uploadedFiles = JSON.parse(response.body)
                        uploadedFiles.map(item=>this.log(item))
                        this.log(`${uploadedFiles.length} Files ${gutil.colors.bold.green('successfully')} uploaded.`)
                        this.trigger('uploaded')
                    } else {
                        this.error('Error while uploading files: ' + response.statusCode + ' - ' + response.statusMessage)
                        this.trigger('error')
                    }
                    cb(null)
                })
            }
        )
    }

    removeAllResources() {
        this.trigger('remove')
        request({
            url: strformat(this.options.target.confluenceBaseUrl + DELETE_REST_URL, this.options.themeId),
            method: 'DELETE',
            headers: {
                'Authorization': ('Basic ' + new Buffer(this.options.target.username + ':' + this.options.target.password).toString('base64'))
            }
        }, (error, response, body) => {
            if (!error && response.statusCode == 204) {
                this.log('Resources succesfully removed.')
                this.trigger('removed')
            } else {
                this.log('Error while removing resources:\n' +
                response.statusCode + ' - ' + response.statusMessage)
                this.trigger('error')
            }
        })
    }
}

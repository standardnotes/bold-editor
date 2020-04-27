# Bold Editor

The Bold Editor is a Standard Notes derived editor that offers text formatting and FileSafe integration.

## Installation

1. Clone the bold-editor repository from GitHub.

1. Run `npm install` to install the required dependencies. If there are errors, delete the `package-lock.json` file and `node_modules` folder. Then run `npm install` again. This is equivalent to "turning it off and on again" for npm. ([source](https://stackoverflow.com/questions/48298361/npm-install-failed-at-the-node-sass4-5-0-postinstall-script))

1. Setup the FileSafe integration locally.

1. Change the commented out lines in `index.html`

1. Run `npm install -g http-server` to install a simple local server to host the extension.

## Development with webpack Watch Mode

Start by following the instructions here: https://docs.standardnotes.org/extensions/local-setup

This will quickly setup a local server from which the bold-editor can be imported via the desktop app or the web app. You should be able to use the bold-editor now.

However, this will not allow for easy development because the app will not automatically build to the dist folder. We will use webpack for this.

In the `package.json` file, under `scripts`, add the following line:

```"watch": "webpack --watch"```

(Additional webpack documentation can be found [here](https://webpack.js.org/guides/development/#using-watch-mode))

There should be an existing console open that is running the http-server. Open a new console and run `npm run watch` which will automatically build the `app.min.js` file.
  
On some systems, this should be all that is needed. Make some changes to `Editor.js`, reload the desktop or web app, and your changes will show up. This did not work in my case. Why? Reloading did not reload the cache and changes did not show up.

Solution: disable the cache. On desktop or web, open devtools (Ctrl+Shift+i) and go to network. There is an option to 'Disable cache' which is exactly what we want. Devtools must be kept open for this to work.

## Development with webpack-dev-server

If using webpack-dev-server via `npm run start`, import the following in index.html:

```
<script type="text/javascript" src="redactor.min.js"></script>
<script type="text/javascript" src="app.min.js"></script> 
```
(Dev server only actively builds app.min.js).

## Production

In production environments, import 

```
<script type="text/javascript" src="dist.min.js"></script>
```

which is built via `grunt`.

The CSS is also built with grunt, so webpack-dev-server will not be able to reload it. You must run `npm run build` anytime you change the CSS.

## Support

Please open a new issue and the Standard Notes team will take a look as soon as we can. For more information on editors, refer to the following links:

- Standard Notes Help: [What are editors?](https://standardnotes.org/help/77/what-are-editors)
- Reddit (r/StandardNotes): [What are editors?](https://www.reddit.com/r/StandardNotes/comments/fsdomf/what_are_editors/?utm_source=share&utm_medium=web2x)

Known issue: ordered lists, unordered lists, and tables seem to ignore any font preference you apply to it.

## License

[GNU AGPL v3.0](https://choosealicense.com/licenses/agpl-3.0/)
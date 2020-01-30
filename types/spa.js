'use strict';

// core dependencies
const crypto = require('crypto');
const page = require('page');
const pluralize = require('pluralize');

// Requisite Types
const App = require('./app');
const Router = require('./router');

// Fabric Types
const Circuit = require('@fabric/core/types/circuit');
const Store = require('@fabric/core/types/store');

/**
 * Fully-managed HTML application.
 * @extends App
 */
class SPA extends App {
  /**
   * Create a single-page app.
   * @param  {Object} [settings={}] Settings for the application.
   * @param  {String} [settings.name="@fabric/maki"] Name of the app.
   * @param  {Boolean} [settings.offline=true] Hint offline mode to browsers.
   * @return {App}               Instance of the application.
   */
  constructor (settings = {}) {
    super(settings);

    this.settings = Object.assign({
      title: '@fabric/http',
      synopsis: 'Making beautiful apps a breeze.',
      description: 'Legacy web support for Fabric.',
      handle: 'html',
      language: 'en',
      components: {},
      offline: false
    }, settings);

    // TODO: enable Web Worker integration
    /* this.worker = new Worker('./worker', {
      type: 'module'
    }); */

    this.router = new Router(this.settings);
    this.store = new Store(this.settings);

    this.routes = [];
    this.bindings = {
      'click': this._handleClick.bind(this)
    };

    return this;
  }

  get handler () {
    return page;
  }

  define (name, definition) {
    let route = this.router.define(name, definition);
    if (this.settings.verbosity >= 4) console.log('[WEB:SPA]', 'Defining', name, route);
    this.types.state[name] = definition;
    this.resources[name] = definition;
    return this.resources[name];
  }

  register () {
    return this;
  }

  route (path) {
    for (let i = 0; i < this.routes.length; i++) {
      console.log('[MAKI:SPA]', 'testing route:', this.routes[i]);
    }
  }

  _handleClick (e) {
    console.log('SPA CLICK EVENT:', e);
  }

  async _handleNavigation (ctx) {
    let route = this.router.route(ctx.path);
    let Element = this.components[route.route.component];
    if (!Element) throw new Error(`Could not find component: ${route.route.component}`);
    let resource = new Element(this.state);
    let content = resource.render();
    this._setTitle(resource.name);
    this._renderContent(content);
  }

  async _loadIndex (ctx) {
    let Index = this.components[this.settings.components.index];
    if (!Index) throw new Error(`Could not find component: ${this.settings.components.index}`);
    let resource = new Index(this.state);
    let content = resource.render();
    this._setTitle(resource.name);
    this._renderContent(content);
  }

  _setTitle (title) {
    this.title = `${title} &middot; ${this.settings.name}`;
    document.querySelector('title').innerHTML = this.title;
  }

  _renderWith (html) {
    let hash = crypto.createHash('sha256').update(html).digest('hex');

    // TODO: move CSS to inline from webpack
    return `<!DOCTYPE html>
<html lang="${this.settings.language}"${(this.settings.offline) ? 'manifest="cache.manifest"' : ''}>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>${this.title}</title>
  <!-- <link rel="manifest" href="/manifest.json"> -->
  <link rel="stylesheet" type="text/css" href="/styles/screen.css" />
  <link rel="stylesheet" type="text/css" href="/styles/semantic.css" />
</head>
<body data-bind="${hash}">${html}</body>
</html>`;
  }

  /**
   * Return a string of HTML for the application.
   * @return {String} Fully-rendered HTML document.
   */
  render () {
    let body = super.render();
    // TODO: define Custom Element
    // let app = SPA.toString('base64');
    // definition = customElements.define(name, SPA);

    return this._renderWith(body);
  }

  async stop () {
    if (this.settings.verbosity >= 4) console.log('[HTTP:SPA]', 'Stopping...');

    try {
      await this.router.stop();
    } catch (E) {
      console.error('Could not stop SPA router:', E);
    }

    try {
      await this.store.stop();
    } catch (E) {
      console.error('Could not stop SPA store:', E);
    }

    // await super.stop();
    if (this.settings.verbosity >= 4) console.log('[HTTP:SPA]', 'Stopped!');
    return this;
  }

  async start () {
    if (this.settings.verbosity >= 4) console.log('[HTTP:SPA]', 'Starting...');
    // await super.start();

    try {
      await this.store.start();
    } catch (E) {
      console.error('Could not start SPA store:', E);
    }

    if (this.settings.verbosity >= 4) console.log('[HTTP:SPA]', 'Defining resources...');

    for (let name in this.settings.resources) {
      let definition = this.settings.resources[name];
      let plural = pluralize(name);
      let resource = await this.define(name, definition);
      // console.log('[AUDIT]', 'Created resource:', resource);

      // this.router._addFlat(`/${plural.toLowerCase()}`, definition);
      this.router._addRoute(`/${plural.toLowerCase()}/:id`, definition.components.view);
      this.router._addRoute(`/${plural.toLowerCase()}`, definition.components.list);

      // add menu items & handler
      if (!definition.hidden) {
        this.menu._addItem({ name: plural, path: `/${plural.toLowerCase()}`, icon: definition.icon });
      }

      // page.js router...
      this.handler(`/${plural.toLowerCase()}`, this._handleNavigation.bind(this));
      this.handler(`/${plural.toLowerCase()}/:id`, this._handleNavigation.bind(this));
    }

    try {
      await this.router.start();
    } catch (E) {
      console.error('Could not start SPA router:', E);
    }

    this.title = `${this.settings.synopsis} &middot; ${this.settings.name}`;
    if (this.settings.verbosity >= 4) console.log('[HTTP:SPA]', 'Started!');

    return this;
  }
}

module.exports = SPA;

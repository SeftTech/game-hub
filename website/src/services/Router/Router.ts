import GameHubRoute from '../../pages/GameHub/routes';
import { Route, Routes } from './models';
import UUID from '../../utils/UUID';

type Callback = (route: Route) => void;

/**
 * Fetches the route objects based on a given path
 * @param _path
 * @returns
 */
function lookupRoute(_path: string): Route | undefined {
  return Object.values(Routes).find(({ path }) => path === _path);
}

export class Router {
  private callbacks: Record<string, Callback> = {};
  private proxy: { currentRoute: Route };

  constructor() {
    const self = this;
    // Initialize the route the app was loaded on, and establish the watcher logic
    this.proxy = new Proxy(
      { currentRoute: lookupRoute(window.location.pathname) || GameHubRoute },
      {
        set(obj: Router['proxy'], prop: keyof Router['proxy'], value) {
          if (prop === 'currentRoute') {
            Object.values(self.callbacks).forEach(callback => callback(value));
          }

          // Default setter logic
          // eslint-disable-next-line no-param-reassign
          obj[prop] = value;
          return true;
        },
      }
    );
    this.proxy.currentRoute.module();
    document.title = this.proxy.currentRoute.title;

    // Registering the router for monitoring changes to the window state
    window.addEventListener('popstate', () => {
      this.changeRoute(lookupRoute(window.location.pathname));
    });
  }

  /**
   * Changes the current route to the newly provided route.  Additionally imports that route dynamically.
   * @param route
   */
  async changeRoute(route?: Route) {
    if (!route) {
      this.changeRoute(GameHubRoute);
      return;
    }
    this.proxy.currentRoute = route;

    try {
      const promise = route.module();
      document.title = route.title;
      await promise;
      window.history.pushState({}, route.title, route.path);
    } catch {
      // Bounce the user back to the home page when the route is improperly parsed
      this.changeRoute(GameHubRoute);
    }
  }

  /**
   * Allows watching for changes to the currently loaded route.
   * @param callback
   * @returns
   */
  watch(callback: Callback): () => void {
    callback(this.proxy.currentRoute);
    const key = UUID();
    this.callbacks[key] = callback;

    return () => {
      delete this.callbacks[key];
    };
  }
}

export default new Router();

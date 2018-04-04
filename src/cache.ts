import { Storage } from '@ionic/storage';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/observable/defer';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/share';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/finally';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/startWith';
import 'rxjs/add/operator/combineLatest';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Subject } from 'rxjs/Subject';

export class Cache<T> {
  /**
   * Toggle use of local storage vs memory cache.
   *
   * @type {boolean}
   */
  public useLocalStorage: boolean = true;

  /**
   * Indicates if the cache has been loaded from local storage.
   *
   * @type {boolean}
   */
  public loaded: boolean = false;

  /**
   * Indicates if the cache is empty (observable haven't been called).
   *
   * @type {boolean}
   */
  public empty: boolean;

  /**
   * Public observable for stream of refreshed data.
   *
   * @type {Observable<T>}
   */
  public get$: Observable<T>;

  /**
   * Public observable for any errors from the inner observable.
   *
   * @type {Observable<any>}
   */
  public error$: Observable<any>;

  /**
   * Control whether null is interpreted as empty cache.
   *
   * @type {boolean}
   */
  public allowNull: boolean = false;

  /**
   * In-memory cache.
   *
   * @type {BehaviorSubject<T>}
   */
  private data: BehaviorSubject<T> = new BehaviorSubject<T>(null);

  /**
   * Error subject.
   *
   * @type {Subject<any>}
   */
  private error: Subject<any> = new Subject<any>();

  /**
   * Subscription for refresh call.
   *
   * @type {Observable<T>}
   */
  private refreshObservable: Observable<T>;

  /**
   * Ready promise resolve function.
   *
   * @type {function}
   */
  private readyResolve;

  /**
   * Ready promise.
   *
   * @type {Promise<void>}
   */
  private readyPromise: Promise<void> = new Promise<void>((resolve) => this.readyResolve = resolve);

  /**
   * Cache constructor.
   *
   * @param {string} name
   * @param {Observable<T>} observable
   * @param {Storage} storage
   */
  constructor(public readonly name: string, private observable: Observable<T>, private storage: Storage) {
    this.error$ = this.error.asObservable();

    // The public get$ observable will wait for readyPromise.
    this.get$ = Observable.fromPromise(this.ready()).mergeMap(() => this.data.asObservable()).filter(() => {
      if (this.empty) {
        // Don't return empty data, trigger refresh instead.
        this.refresh().subscribe(); // Ignore subscription, as refresh will trigger the behaviorsubject anyway.

        // Return false to prevent the empty value from propagating.
        return false;
      }

      // Don't pass null if allowNull is set to false.
      return this.allowNull || this.data !== null;
    });

    if (this.useLocalStorage) {
      // Attempt to load cache data from local storage.
      this.storage.ready().then(() => this.storage.get(this.name).then((data: T) => {
        if (typeof data !== 'undefined' && (this.allowNull || data !== null)) {
          // Cached data exists in local storage.
          this.data.next(data);
          this.empty = false;
        } else {
          this.empty = true;
        }

        // Mark Cache and ready.
        this.loaded = true;
        this.readyResolve();
      }, (err) => {
        const errorMessage = 'Cache failed to retrieve "' + this.name + '" from local storage.';

        console.error(errorMessage, err);

        this.error.next(errorMessage);
      }), (err) => {
        const errorMessage = 'Cache failed to access local storage.';

        console.error(errorMessage, err);

        this.error.next(errorMessage);
      });
    } else {
      // Cache is not using local storage, so will always be initialized empty.
      this.empty = true;
      this.readyResolve();
    }
  }

  /**
   * Wait for the Cache object to be ready.
   *
   * @returns {Promise<void>}
   */
  public ready(): Promise<void> {
    return this.readyPromise;
  }

  /**
   * Get the cached data.
   *
   * @returns {Observable<T>}
   */
  public get(): Observable<T> {
    return Observable.fromPromise(this.ready()).mergeMap(() => {
      // Don't return empty observable.
      if (this.empty) {
        return this.refresh();
      } else {
        return Observable.of(this.data.getValue());
      }
    });
  }

  /**
   * Refresh the cache.
   *
   * @returns {Observable<T>}
   */
  public refresh(): Observable<T> {
    if (this.refreshObservable == null) {
      // Store the observable in variable to prevent duplicate refreshes.
      this.refreshObservable = this.observable
        .finally(() => this.refreshObservable = null)
        .do(
          (data: T) => this.set(data),
          (err) => this.error.next(err)
        ).share();
    }

    return this.refreshObservable;
  }

  /**
   * Set the cache data.
   *
   * @param {T} data
   */
  public set(data: T): void {
    this.empty = false;

    this.data.next(data);

    // Save the data to local storage.
    if (this.useLocalStorage) {
      this.ready().then(() => this.storage.set(this.name, data).then(() => this.loaded = true));
    }
  }

  /**
   * Change the internal observable.
   *
   * @param {Observable<T>} observable
   */
  public setObservable(observable: Observable<T>): void {
    this.observable = observable;
  }

  /**
   * Check if the Cache is empty.
   *
   * @returns {boolean}
   */
  public isEmpty(): Promise<boolean> {
    return this.ready().then(() => this.empty);
  }

  /**
   * Observable for data (get$) with optional error callback.
   *
   * @experimental
   * @param {(error: any) => void} errorCallback
   * @returns {Observable<T>}
   */
  public data$(errorCallback?: (error: any) => void): Observable<T> {
    if (errorCallback == null) {
      return this.get$;
    }

    const errorObservable = this.error$
      .do(errorCallback) // Report errors to errorCallback.
      .startWith(null)
      .filter((v) => v === null); // Don't send the error to combineLatest.

    return this.get$.combineLatest(errorObservable).map(([v]) => v);
  }

}

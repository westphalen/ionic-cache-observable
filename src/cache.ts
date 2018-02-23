import { Storage } from '@ionic/storage';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/observable/defer';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/share';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/mergeMap';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

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
   * @type {Promise<any>}
   */
  private readyPromise: Promise<any> = new Promise<any>((resolve) => this.readyResolve = resolve);

  /**
   * Cache constructor.
   *
   * @param {string} name
   * @param {Observable<T>} observable
   * @param {Storage} storage
   */
  constructor(public readonly name: string, private observable: Observable<T>, private storage: Storage) {
    this.get$ = Observable.fromPromise(this.ready()).mergeMap(() => this.data.asObservable()).filter(() => {
      // Don't return empty data, trigger refresh instead.
      if (this.empty) {
        this.refresh().subscribe(); // Ignore subscription, as refresh will trigger the behaviorsubject anyway.
        return false;
      }

      return this.allowNull || this.data !== null;
    });

    if (this.useLocalStorage) {
      this.storage.ready().then(() => this.storage.get(this.name).then((data: T) => {
        console.log('Cache "' + this.name + '": loaded.', data);
        if (typeof data !== 'undefined' && (this.allowNull || data !== null)) {
          this.data.next(data);
          this.empty = false;
        } else {
          this.empty = true;
        }
        this.loaded = true;
        this.readyResolve();
      }));
    } else {
      this.empty = true;
      this.readyResolve();
    }
  }

  /**
   * Wait for the Cache object to be ready.
   *
   * @returns {Promise<any>}
   */
  public ready(): Promise<any> {
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
    if (!this.refreshObservable) {
      console.log('Cache "' + this.name + '": Refreshing.');
      this.refreshObservable = this.observable.do(
        (data: T) => this.set(data),
        () => this.refreshObservable = null,
        () => this.refreshObservable = null
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
    if (this.useLocalStorage) {
      this.ready().then(() => this.storage.set(this.name, data).then(() => this.loaded = true));
    }

    this.empty = false;
    this.data.next(data);
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

}

import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { Cache } from './cache';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/throw';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';

@Injectable()
export class CacheService {
  /**
   * Registered caches.
   *
   * @type {Cache[]}
   */
  private caches: Cache<any>[] = [];

  /**
   * CacheService constructor.
   *
   * @param {Storage} storage
   */
  constructor(private storage: Storage) { }

  /**
   * Register an observable to a named cache.
   *
   * @param {string} name
   * @param {Observable<T>} observable
   * @param {boolean} overwrite
   * @returns {Cache<T>}
   */
  public register<T>(name: string, observable: Observable<T>, overwrite?: boolean): Observable<Cache<T>> {
    return this.get(name).catch(() => {
      let cache = new Cache<T>(name, observable, this.storage);

      let index = this.caches.push(cache) - 1;

      return Observable.of(this.caches[index]);
    }).map((cache: Cache<T>) => {
      if (overwrite !== false) {
        cache.setObservable(observable);
      }

      return cache;
    });
  }

  /**
   * Get previously registered cache.
   *
   * @param {string} name
   * @returns {Observable<Cache<any>>}
   */
  public get(name: string): Observable<Cache<any>> {
    for (let i = 0; i < this.caches.length; i++) {
      if (this.caches[i].name === name) {
        return Observable.of(this.caches[i]);
      }
    }

    return Observable.throw('Cache "' + name + " has not been registered yet.");
  }
}

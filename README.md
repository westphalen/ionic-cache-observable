# ionic-offline-observable

Simple module to cache observables to local storage and get or refresh their values across your app.
This improves performance by only executing observables once, and allows your app to show the cached content when offline or before content is loaded on a slow connection. 

## Installation

Install the package:

    npm install --save ionic-cache-observable
    
Import in your project `app.module.ts`:

    @NgModule({
        imports: [
            IonicModule.forRoot(App),
            IonicStorageModule.forRoot(),
            CacheModule,
            ...
        ]
    })
    
## Blog post

Read about using the module or try out the sample Ionic app on [Medium](https://medium.com/@westphalen/make-offline-capable-ionic-apps-with-cached-observables-12d79a3a1e75).

## Usage example

You have a page, `ShoppingListPage`, that shows the user's shoppinglist.
The shopping list is normally retrieved from your server with your `ShoppingListProvider` service.

With the implementation below, it is either retrieved by local storage OR from the provider.

    constructor(private cacheService: CacheService,
                private shoppingListProvider: ShoppingListProvider) { }

    ionViewWillEnter() {
        // The observable you normally get items from server with.
        let shoppingListObservable: Observable<ShoppingList> = this.shoppingListProvider.get();

        this.cacheService
            .register('shoppingList', shoppingListObservable)
            .mergeMap((cache: Cache<ShoppingList>) => cache.get())
            .subscribe((shoppingList) => {
              // The shopping list is retrieved from local storage,
              // or in the case that it doesn't exist in storage yet;
              // by triggering your shoppingListObservable.
              this.shoppingList = shoppingList;
            });
  
    }
    
    refreshShoppingList() {
        this.cacheService
            .get('shoppingList')
            .mergeMap((cache: Cache<ShoppingList>) => cache.refresh())
            .subscribe((shoppingList) => {
              // The shopping list was just "refreshed" by calling the
              // shoppingListProvider observable that was registered with the cache.
              this.shoppingList = shoppingList;
            });    
    }
    
A more flexible approach is to use the BehaviorSubject.
This also allows you to easily refresh and get the cached shopping list at the same time:

    private cache: Cache<ShoppingList>;
    
    private cacheSubscription: Subscription;

    ionViewWillEnter() {
        this.cacheSubscription = this.cacheService
            .register('shoppingList', shoppingListObservable)
            .mergeMap((cache: Cache<ShoppingList>) => {
                this.cache = cache;
                
                // We can call refresh already. The refreshed value will be 
                // passed to the get$ BehaviorSubject.
                this.cache.refresh().subscribe();
                
                return this.cache.get$;
            }).subscribe((shoppingList) => {
                // This is a long-lived Observable that will be triggered when the 
                // Cache is first initialized with the locally stored value,
                // and whenever refresh is called.
            
                this.shoppingList = shoppingList;
            });
    }
    
    refreshShoppingList() {
        // Just call refresh, the cacheSubscription takes care of the rest.
        this.cache.refresh().subscribe();    
    }
    
Make sure to unsubscribe when needed, ie in `ionViewWillLeave`.

## Functionality

1. Keep in mind: When registering a Cache, it will immediately load the locally stored value to memory.

2. `Cache.isEmpty` can be used to determine if the cache has a value. If it is empty, it will automatically try to refresh.

3. `NULL` values can be a problem in determining if the cache is empty and should be refreshed.

4. Depending on your application flow, use `CacheService.register` or `CacheService.get`.
    1. If you need to use the same `Cache` object on multiple pages, you can either `register` it globally first (ie your `AppComponent`, `app.ts`) and `get` it on all the pages.
    2. Or you can register the same cache multiple times. It is perfectly legal and will not invalidate existing cache objects, 
    simply update its internal `Observable`, unless the overwrite parameter is set to false `register(name, false)`.
    3. But don't `register` the same cache with a completely different observable, and don't `get` caches that hasn't been registered.
    
5. Advanced usage might have you re-registering the cache with a more detailed observable.
    1. First it's registered with `shoppingListProvider.get()`
    2. On a deeper page, you can re-register with `shoppingListProvider.get({include: 'users'})`, because that page needs the the shopping list's owners.
    3. The deeper page would first display the cached value (without owners) and then when the refreshed value arrives, add the user info. 

## Contribution

This is just something I threw together quickly because I needed a simple, reusable solution to support offline apps.

However, I will maintain the project and welcome any contributions.

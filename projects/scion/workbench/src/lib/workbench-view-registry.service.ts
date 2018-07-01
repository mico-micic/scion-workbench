import { ComponentFactoryResolver, Injectable, Injector, OnDestroy } from '@angular/core';
import { ROUTER_OUTLET_NAME, VIEW_REF_PREFIX } from './workbench.constants';
import { InternalWorkbenchView, WorkbenchView } from './workbench.model';
import { PortalInjector } from '@angular/cdk/portal';
import { ViewComponent } from './view/view.component';
import { WorkbenchService } from './workbench.service';
import { WbComponentPortal } from './portal/wb-component-portal';
import { ViewOutletUrlObserver } from './routing/view-outlet-url-observer.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Registry for {WorkbenchView} objects.
 */
@Injectable()
export class WorkbenchViewRegistry implements OnDestroy {

  private readonly _destroy$ = new Subject<void>();
  private readonly _viewRegistry = new Map<string, InternalWorkbenchView>();

  constructor(private _injector: Injector,
              private _componentFactoryResolver: ComponentFactoryResolver,
              private _workbench: WorkbenchService,
              viewOutletUrlObserver: ViewOutletUrlObserver) {

    viewOutletUrlObserver.viewOutletAdd$
      .pipe(takeUntil(this._destroy$))
      .subscribe((viewRef: string) => {
        this._viewRegistry.set(viewRef, this.createWorkbenchView(viewRef));
      });

    viewOutletUrlObserver.viewOutletRemove$
      .pipe(takeUntil(this._destroy$))
      .subscribe((viewRef: string) => {
        this._viewRegistry.get(viewRef).portal.destroy();
        this._viewRegistry.delete(viewRef);
      });
  }

  private createWorkbenchView(viewRef: string): InternalWorkbenchView {
    const portal = new WbComponentPortal<ViewComponent>(this._componentFactoryResolver, ViewComponent);
    const view = new InternalWorkbenchView(viewRef, this._workbench, portal);

    const injectionTokens = new WeakMap();
    injectionTokens.set(ROUTER_OUTLET_NAME, viewRef);
    injectionTokens.set(WorkbenchView, view);
    injectionTokens.set(InternalWorkbenchView, view);

    portal.init({
      injector: new PortalInjector(this._injector, injectionTokens),
      onActivate: (): void => view.activate(true),
      onDeactivate: (): void => view.activate(false),
    });

    return view;
  }

  /**
   * Computes a view outlet identity which is unique in this application.
   */
  public computeNextViewOutletIdentity(): string {
    let i = this._viewRegistry.size + 1;
    for (; this._viewRegistry.has(VIEW_REF_PREFIX + i); i++) {
    }
    return VIEW_REF_PREFIX + i;
  }

  /**
   * Returns the view for the specified 'viewRef', or throws an Error if not found.
   */
  public getElseThrow(viewRef: string): InternalWorkbenchView {
    const view = this._viewRegistry.get(viewRef);
    if (!view) {
      throw Error('Illegal state: view not contained in view registry');
    }
    return view;
  }

  /**
   * Returns the view for the specified 'viewRef', or 'null' if not found.
   */
  public getElseNull(viewRef: string): InternalWorkbenchView | null {
    return this._viewRegistry.get(viewRef) || null;
  }

  public get all(): InternalWorkbenchView[] {
    return Array.from(this._viewRegistry.values());
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
  }
}

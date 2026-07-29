import { AfterContentInit, Component, ContentChildren, QueryList, input, model } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { TabPanelComponent } from './tab-panel.component';

@Component({
  selector: 'app-tab-group',
  standalone: true,
  imports: [NgTemplateOutlet, CardModule, TabsModule],
  template: `
    @if (framed()) {
      <p-card>
        <ng-container *ngTemplateOutlet="tabsTemplate" />
      </p-card>
    } @else {
      <ng-container *ngTemplateOutlet="tabsTemplate" />
    }

    <ng-template #tabsTemplate>
      <p-tabs [value]="value()" (valueChange)="onValueChange($event)">
        <p-tablist>
          @for (panel of panelItems; track panel.value()) {
            <p-tab [value]="panel.value()">{{ panel.label() }}</p-tab>
          }
        </p-tablist>
        <p-tabpanels>
          @for (panel of panelItems; track panel.value()) {
            <p-tabpanel [value]="panel.value()">
              <ng-container *ngTemplateOutlet="panel.content" />
            </p-tabpanel>
          }
        </p-tabpanels>
      </p-tabs>
    </ng-template>
  `,
})
export class TabGroupComponent implements AfterContentInit {
  readonly value = model<string>('');
  readonly framed = input<boolean>(true);

  @ContentChildren(TabPanelComponent) protected readonly panels!: QueryList<TabPanelComponent>;

  protected get panelItems(): readonly TabPanelComponent[] {
    return this.panels?.toArray() ?? [];
  }

  ngAfterContentInit(): void {
    if (!this.value() && this.panels.first) {
      this.value.set(this.panels.first.value());
    }
  }

  protected onValueChange(value: string | number | undefined): void {
    if (typeof value === 'string') {
      this.value.set(value);
    }
  }
}

import { Component, TemplateRef, ViewChild, input } from '@angular/core';

@Component({
  selector: 'app-tab-panel',
  standalone: true,
  template: '<ng-template #tpl><ng-content /></ng-template>',
})
export class TabPanelComponent {
  readonly value = input.required<string>();
  readonly label = input.required<string>();

  @ViewChild('tpl', { static: true }) content!: TemplateRef<unknown>;
}

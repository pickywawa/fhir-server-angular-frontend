import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';


export interface TabItem {
  key: string;
  label: string;
}

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.scss'
})
export class TabBarComponent {
  @Input() tabs: TabItem[] = [];
  @Input() activeTab = '';
  @Output() tabChange = new EventEmitter<string>();

  selectTab(tabKey: string): void {
    if (!tabKey || tabKey === this.activeTab) {
      return;
    }
    this.tabChange.emit(tabKey);
  }
}

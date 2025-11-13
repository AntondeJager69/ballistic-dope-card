import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RiflesTabComponent } from './rifles-tab/rifles-tab.component';
import { VenuesTabComponent } from './venues-tab/venues-tab.component';
import { SessionTabComponent } from './session-tab/session-tab.component';
import { HistoryTabComponent } from './history-tab/history-tab.component';

type Tab = 'rifles' | 'venues' | 'session' | 'history';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RiflesTabComponent,
    VenuesTabComponent,
    SessionTabComponent,
    HistoryTabComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  activeTab: Tab = 'session';

  setTab(tab: Tab) {
    this.activeTab = tab;
  }
}

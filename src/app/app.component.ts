import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RiflesTabComponent } from './rifles-tab/rifles-tab.component';
import { VenuesTabComponent } from './venues-tab/venues-tab.component';
import { SessionTabComponent } from './session-tab/session-tab.component';
import { HistoryTabComponent } from './history-tab/history-tab.component';

type TabName = 'menu' | 'rifles' | 'venues' | 'session' | 'history';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,          // needed for ngModel in the menu reports form
    RiflesTabComponent,
    VenuesTabComponent,
    SessionTabComponent,
    HistoryTabComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  // Default tab is the Menu
  currentTab: TabName = 'menu';

  // Simple state for the Reports mini-wizard on the Menu tab
  showReportsForm = false;
  reportTopic: string = '';
  reportDetails: string = '';

  setTab(tab: TabName) {
    this.currentTab = tab;
    // Reset menu-specific UI whenever we leave Menu
    if (tab !== 'menu') {
      this.showReportsForm = false;
      this.reportTopic = '';
      this.reportDetails = '';
    }
  }

  // MENU actions
  startEvent() {
    // Jump straight to the Session wizard tab
    this.setTab('session');
  }

  showLoadDevelopmentInfo() {
    alert(
      'Load Development is a planned future feature.\n\n' +
      'Here you will be able to record ladder tests, OCW, and compare groups for different loads.'
    );
  }

  openReports() {
    this.showReportsForm = true;
  }

  submitReportRequest() {
    if (!this.reportTopic.trim()) {
      alert('Please tell me what information you want in the report.');
      return;
    }

    alert(
      'Report request noted:\n\n' +
      `Topic: ${this.reportTopic}\n` +
      (this.reportDetails ? `Details: ${this.reportDetails}` : '') +
      '\n\nIn a future version this will filter data from History ' +
      'and show previous dope, sessions at the same venue/sub-range, etc.'
    );

    this.showReportsForm = false;
    this.reportTopic = '';
    this.reportDetails = '';
  }
}

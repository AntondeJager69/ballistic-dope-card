import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { DataService } from '../data.service';
import { Session } from '../models';

@Component({
  selector: 'app-history-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-tab.component.html',
  styleUrls: ['./history-tab.component.css']
})
export class HistoryTabComponent implements OnInit {
  sessions: Session[] = [];
  expandedId: number | null = null;

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh() {
    this.sessions = this.data.getSessions();
  }

  toggle(session: Session) {
    this.expandedId = this.expandedId === session.id ? null : session.id;
  }

  delete(session: Session) {
    if (confirm('Delete this session from history?')) {
      this.data.deleteSession(session.id);
      this.refresh();
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }
}

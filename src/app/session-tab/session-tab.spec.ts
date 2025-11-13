import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionTab } from './session-tab';

describe('SessionTab', () => {
  let component: SessionTab;
  let fixture: ComponentFixture<SessionTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionTab]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SessionTab);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

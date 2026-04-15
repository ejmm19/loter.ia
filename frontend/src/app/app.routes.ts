import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LotteryDetailComponent } from './lottery-detail/lottery-detail.component';
import { DrawDetailComponent } from './draw-detail/draw-detail.component';
import { CalendarComponent } from './calendar/calendar.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'calendario', component: CalendarComponent },
  { path: 'loteria/:slug', component: LotteryDetailComponent },
  { path: 'loteria/:slug/sorteo/:date', component: DrawDetailComponent },
];

import { Component } from '@angular/core';

@Component({
  selector: 'app-dialog-base',
  standalone: true,
  template: `<ng-content></ng-content>`
})
export class DialogBaseComponent {}

export class Logger {
  history: { ts: number; level: 'debug'|'info'|'warn'|'error'; message: string }[] = [];
  constructor(public prefix='CV'){
  }
  private push(level: 'debug'|'info'|'warn'|'error', message: string){
    this.history.push({ ts: Date.now(), level, message });
    // eslint-disable-next-line no-console
    console[level](`[${this.prefix}] ${message}`);
  }
  debug(m: string){ this.push('debug', m); }
  info(m: string){ this.push('info', m); }
  warn(m: string){ this.push('warn', m); }
  error(m: string){ this.push('error', m); }
}

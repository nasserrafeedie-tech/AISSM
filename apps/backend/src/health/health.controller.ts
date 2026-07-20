import { Controller, Get, Headers, NotFoundException } from '@nestjs/common';
import { buildReadinessReport, type ReadinessReport } from './launch-readiness.service';

/**
 * Lightweight liveness endpoints. Hosting platforms (Render, Railway, etc.)
 * ping /health to know the service booted; the root path is a friendly note
 * for anyone who opens the backend URL in a browser.
 *
 * /health/launch is the operator's go/no-go table — admin-gated, because
 * which integrations are live is business information, not public trivia.
 */
@Controller()
export class HealthController {
  @Get('health')
  health(): { status: string; time: string } {
    return { status: 'ok', time: new Date().toISOString() };
  }

  /**
   * Launch readiness. Fails closed exactly like the admin view: no token
   * configured, or a wrong one, and the route may as well not exist.
   */
  @Get('health/launch')
  launch(@Headers('x-admin-token') token: string | undefined): ReadinessReport {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected || token !== expected) throw new NotFoundException();
    return buildReadinessReport();
  }

  @Get()
  root(): { service: string; status: string } {
    return { service: 'aissm-backend', status: 'ok' };
  }
}

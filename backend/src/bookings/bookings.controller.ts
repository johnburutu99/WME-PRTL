import { Controller, Get, Post, Body, UseGuards, Request, Param, Patch } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, BookingStatus } from '@prisma/client';
import { CreateBookingDto } from './dto/booking.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // 1. Dynamic JSON schema endpoint for forms
  @Get('schema')
  getSchema() {
    return this.bookingsService.getSchema();
  }

  // 2. Submit booking (Buyer only)
  @Post()
  @Roles(Role.BUYER)
  async createBooking(@Request() req, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(req.user.id, dto);
  }

  // 3. Get all bookings for current user based on RBAC rules
  @Get()
  async getBookings(@Request() req) {
    return this.bookingsService.getBookingsForUser(req.user);
  }

  // 4. Offer Desk Response (Talent only)
  @Patch(':id/respond')
  @Roles(Role.TALENT)
  async respondToOffer(
    @Param('id') bookingId: string,
    @Request() req,
    @Body('status') status: 'CONFIRMED' | 'OFFER_REJECTED',
  ) {
    return this.bookingsService.respondToOffer(bookingId, req.user.id, status);
  }

  // 5. Get Talent Ledgers (Talent only)
  @Get('ledger')
  @Roles(Role.TALENT)
  async getLedger(@Request() req) {
    return this.bookingsService.getLedgerForTalent(req.user.id);
  }

  // 6. Manual override for demonstration / agent vetting
  @Patch(':id/status')
  @Roles(Role.AGENT, Role.ADMIN)
  async overrideStatus(@Param('id') bookingId: string, @Body('status') status: BookingStatus) {
    return this.bookingsService.updateStatus(bookingId, status);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Address } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('users/me/addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Address[]> {
    return this.addressesService.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
  ): Promise<Address> {
    return this.addressesService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<Address> {
    return this.addressesService.update(user.id, id, dto);
  }

  @Patch(':id/default')
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<Address> {
    return this.addressesService.setDefault(user.id, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    return this.addressesService.remove(user.id, id);
  }
}

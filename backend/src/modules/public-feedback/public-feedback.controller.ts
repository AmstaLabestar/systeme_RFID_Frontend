import { Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubmitPublicFeedbackDto } from './dto/submit-public-feedback.dto';
import { PublicFeedbackService } from './public-feedback.service';

@Controller('public')
export class PublicFeedbackController {
  constructor(private readonly publicFeedbackService: PublicFeedbackService) {}

  @Post('feedback/:qrToken')
  @Throttle({
    global: {
      limit: 20,
      ttl: 60_000,
    },
  })
  submitByQrToken(@Param('qrToken') qrToken: string, @Body() dto: SubmitPublicFeedbackDto) {
    return this.publicFeedbackService.submitByQrToken(qrToken, dto);
  }
}

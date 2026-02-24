import { Body, Controller, Param, Post } from '@nestjs/common';
import { SubmitPublicFeedbackDto } from './dto/submit-public-feedback.dto';
import { PublicFeedbackService } from './public-feedback.service';

@Controller('public')
export class PublicFeedbackController {
  constructor(private readonly publicFeedbackService: PublicFeedbackService) {}

  @Post('feedback/:qrToken')
  submitByQrToken(@Param('qrToken') qrToken: string, @Body() dto: SubmitPublicFeedbackDto) {
    return this.publicFeedbackService.submitByQrToken(qrToken, dto);
  }
}

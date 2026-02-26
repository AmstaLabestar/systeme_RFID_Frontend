import { Module } from '@nestjs/common';
import { PublicFeedbackController } from './public-feedback.controller';
import { PublicFeedbackService } from './public-feedback.service';

@Module({
  controllers: [PublicFeedbackController],
  providers: [PublicFeedbackService],
  exports: [PublicFeedbackService],
})
export class PublicFeedbackModule {}

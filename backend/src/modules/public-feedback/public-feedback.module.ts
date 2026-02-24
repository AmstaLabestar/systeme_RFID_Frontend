import { Module } from '@nestjs/common';
import { SystemsModule } from '../systems/systems.module';
import { PublicFeedbackController } from './public-feedback.controller';
import { PublicFeedbackService } from './public-feedback.service';

@Module({
  imports: [SystemsModule],
  controllers: [PublicFeedbackController],
  providers: [PublicFeedbackService],
  exports: [PublicFeedbackService],
})
export class PublicFeedbackModule {}

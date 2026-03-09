import { Test } from '@nestjs/testing';
import { PublicFeedbackController } from './public-feedback.controller';
import { PublicFeedbackService } from './public-feedback.service';

describe('PublicFeedbackController', () => {
  const publicFeedbackService = {
    submitByQrToken: jest.fn(),
  };

  let controller: PublicFeedbackController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicFeedbackController],
      providers: [
        {
          provide: PublicFeedbackService,
          useValue: publicFeedbackService,
        },
      ],
    }).compile();

    controller = moduleRef.get(PublicFeedbackController);
  });

  it('submits feedback through the service', async () => {
    const dto = { value: 'POSITIVE', comment: 'Great service' };
    publicFeedbackService.submitByQrToken.mockResolvedValueOnce({ success: true });

    await expect(controller.submitByQrToken('token-1', dto as any)).resolves.toEqual({
      success: true,
    });
    expect(publicFeedbackService.submitByQrToken).toHaveBeenCalledWith('token-1', dto);
  });
});

import { Schema, model, type InferSchemaType } from 'mongoose';

const topicSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    parentTopic: {
      type: Schema.Types.ObjectId,
      ref: 'Topic',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export type TopicType = InferSchemaType<typeof topicSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const Topic = model<typeof topicSchema>('Topic', topicSchema);

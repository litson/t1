export const pluginSchema = {
  title: 'Dflux themify Plugin options',
  type: 'object',
  additionalProperties: false,
  properties: {
    target: {
      type: 'string',
      description: 'target的描述',
      link: '',
    },
    expansion: {
      description: 'expansion的描述',
      link: '',
      type: 'array',
    },
  },
}

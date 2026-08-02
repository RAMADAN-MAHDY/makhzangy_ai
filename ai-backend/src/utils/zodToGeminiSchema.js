/**
 * Minimal, dependency-free converter from a Zod object schema to the
 * JSON-schema-like shape Gemini's Function Calling expects.
 *
 * Only supports what our tools actually use (string/number/boolean/object,
 * optional, describe()). Extend as needed — do not reach for a heavy
 * "zod-to-json-schema" package just for this small surface.
 */
export function zodToGeminiSchema(zodObjectSchema) {
  const shape = zodObjectSchema._def.shape();
  const properties = {};
  const required = [];

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const { type, description, isOptional } = unwrap(fieldSchema);
    properties[key] = { type, ...(description ? { description } : {}) };
    if (!isOptional) required.push(key);
  }

  return {
    type: 'OBJECT',
    properties,
    ...(required.length ? { required } : {}),
  };
}

function unwrap(fieldSchema) {
  let schema = fieldSchema;
  let isOptional = false;
  let description = schema.description;

  while (schema._def?.typeName === 'ZodOptional' || schema._def?.typeName === 'ZodDefault') {
    isOptional = true;
    schema = schema._def.innerType;
    description = description || schema.description;
  }

  const typeName = schema._def?.typeName;
  const typeMap = {
    ZodString: 'STRING',
    ZodNumber: 'NUMBER',
    ZodBoolean: 'BOOLEAN',
    ZodObject: 'OBJECT',
    ZodArray: 'ARRAY',
  };

  return {
    type: typeMap[typeName] || 'STRING',
    description: description || schema._def?.description,
    isOptional,
  };
}

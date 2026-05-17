export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
};

export type ToolFn = (
  args: Record<string, unknown>,
) => string | Promise<string>;

export type Tool = {
  def: ToolDef;
  fn: ToolFn;
};

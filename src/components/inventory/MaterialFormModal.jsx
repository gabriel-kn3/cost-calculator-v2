import React, { useEffect, useState } from 'react';
import { Layer, Box, Text, Button, Form, FormField, TextInput, TextArea, CheckBox } from 'grommet';

const empty = {
  id: null,
  name: '',
  base_cost: 0,
  base_qty: 1,
  supplier: '',
  description: '',
  active: true
};

export default function MaterialFormModal({ open, initialMaterial, onClose, onSave }) {
  const [value, setValue] = useState(empty);

  useEffect(() => {
    if (open) {
      setValue({ ...empty, ...(initialMaterial || {}) });
    }
  }, [open, initialMaterial]);

  if (!open) return null;

  const close = () => onClose?.();

  return (
    <Layer onEsc={close} onClickOutside={close}>
      <Box pad="medium" width={{ min: '560px', max: '720px' }} gap="medium">
        <Text weight={700} size="large">
          {value.id ? 'Edit Material' : 'Add Material'}
        </Text>

        <Form
          value={value}
          onChange={setValue}
          onSubmit={async () => {
            const payload = {
              ...value,
              base_cost: Number(value.base_cost || 0),
              base_qty: Number(value.base_qty || 1)
            };
            await onSave?.(payload);
          }}
        >
          <Box direction="row" gap="medium" wrap>
            <Box flex>
              <FormField name="name" label="Name" required>
                <TextInput name="name" placeholder="e.g. Aluminum Sheet *" />
              </FormField>
            </Box>
            <Box width="180px">
              <FormField name="base_cost" label="Base Cost" required>
                <TextInput name="base_cost" type="number" />
              </FormField>
            </Box>
            <Box width="180px">
              <FormField name="base_qty" label="Base Qty" required>
                <TextInput name="base_qty" type="number" />
              </FormField>
            </Box>
          </Box>

          <FormField name="supplier" label="Supplier">
            <TextInput name="supplier" placeholder="Optional" />
          </FormField>

          <FormField name="description" label="Description">
            <TextArea name="description" rows={3} placeholder="Optional" />
          </FormField>

          <CheckBox
            label="Active"
            checked={!!value.active}
            onChange={(e) => setValue((v) => ({ ...v, active: e.target.checked }))}
          />

          <Box direction="row" gap="small" justify="end" pad={{ top: 'small' }}>
            <Button label="Cancel" onClick={close} />
            <Button primary type="submit" label="Save" />
          </Box>
        </Form>
      </Box>
    </Layer>
  );
}

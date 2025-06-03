import { cva, VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import React from 'react';

const button = cva('font-semibold', {
    variants: {
        variant: {
            primary: 'bg-primary-main text-white',
            secondary: 'bg-primary-light text-main',
            danger: 'bg-danger-main text-white',
            'seconda': 'bg-danger-light text-danger-main',
        }
    }
})
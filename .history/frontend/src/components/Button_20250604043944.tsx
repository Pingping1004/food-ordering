import React from 'react';
import clsx from 'clsx';

type ButtonProps = {
    chiidren: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger';
    className?: string;
    onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({
    chiidren,
    variant = 'primary',
    className,
    onClick,
}) => {
    const baseStyles = 'px-5 py-2.5 rounded-2xl noto-sans-regular';
    const variantStyles = {
        
    }
}
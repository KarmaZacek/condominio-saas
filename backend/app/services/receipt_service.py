"""
Servicio para generación de recibos de pago en PDF.
"""
from io import BytesIO
from datetime import datetime
from decimal import Decimal
from typing import Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
import os


# Configuración del condominio
CONDOMINIO_CONFIG = {
    "nombre_legal": "Condominio Parques de Santa Cruz 9 Manzana XIV",
    "nombre_comun": "Coto San Camilo 2898",
    "direccion": "San Camilo 2898, Parques de Santa Cruz",
    "ciudad": "Tlaquepaque, Jalisco",
    "telefono": "",
    "email": "",
}

# Ruta del logo
LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "static", "images", "logo.jpg")


def _format_currency(amount: Decimal) -> str:
    """Formatea cantidad a moneda mexicana."""
    return f"${amount:,.2f} MXN"


def _format_date(date_obj) -> str:
    """Formatea fecha al español."""
    meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ]
    return f"{date_obj.day} de {meses[date_obj.month - 1]} de {date_obj.year}"


def _numero_a_letras(numero: Decimal) -> str:
    """Convierte número a palabras en español."""
    unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
    decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 
               'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
    especiales = {
        11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
        16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
        21: 'VEINTIUNO', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO',
        25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO',
        29: 'VEINTINUEVE'
    }
    centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
                'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']
    
    def convertir_grupo(n):
        if n == 0:
            return ''
        if n == 100:
            return 'CIEN'
        if n in especiales:
            return especiales[n]
        
        resultado = ''
        
        # Centenas
        if n >= 100:
            resultado += centenas[n // 100] + ' '
            n = n % 100
        
        # Decenas y unidades
        if n in especiales:
            resultado += especiales[n]
        elif n >= 10:
            resultado += decenas[n // 10]
            if n % 10 != 0:
                resultado += ' Y ' + unidades[n % 10]
        else:
            resultado += unidades[n]
        
        return resultado.strip()
    
    entero = int(numero)
    centavos = int((numero - entero) * 100)
    
    if entero == 0:
        resultado = 'CERO'
    elif entero == 1:
        resultado = 'UN'
    elif entero < 1000:
        resultado = convertir_grupo(entero)
    elif entero < 2000:
        resultado = 'MIL ' + convertir_grupo(entero % 1000)
    elif entero < 1000000:
        miles = entero // 1000
        resto = entero % 1000
        resultado = convertir_grupo(miles) + ' MIL'
        if resto > 0:
            resultado += ' ' + convertir_grupo(resto)
    else:
        resultado = str(entero)
    
    return f"{resultado} PESOS {centavos:02d}/100 M.N."


def generate_receipt_pdf(
    transaction_id: str,
    folio: str,
    transaction_date,
    amount: Decimal,
    description: str,
    category_name: str,
    payment_method: str,
    reference_number: Optional[str],
    unit_number: Optional[str],
    resident_name: Optional[str],
    treasurer_name: Optional[str] = None,
    notes: Optional[str] = None,
    logo_path: Optional[str] = None
) -> BytesIO:
    """
    Genera un recibo de pago en formato PDF.
    
    Args:
        treasurer_name: Nombre del tesorero en turno (quien firma el recibo)
    
    Returns:
        BytesIO: Buffer con el PDF generado
    """
    buffer = BytesIO()
    
    # Usar logo por defecto si no se especifica
    if logo_path is None:
        logo_path = LOGO_PATH
    
    # Configurar documento
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=1*cm,
        leftMargin=1*cm,
        topMargin=1*cm,
        bottomMargin=1*cm
    )
    
    # Estilos
    styles = getSampleStyleSheet()
    
    # Estilos personalizados
    style_title = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=2,
        textColor=colors.HexColor('#1a365d')
    )
    
    style_subtitle = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#4a5568')
    )
    
    style_header = ParagraphStyle(
        'Header',
        parent=styles['Heading2'],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=12,
        spaceBefore=12,
        textColor=colors.HexColor('#2d3748'),
        backColor=colors.HexColor('#e2e8f0')
    )
    
    style_label = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#718096')
    )
    
    style_value = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#1a202c')
    )
    
    style_amount = ParagraphStyle(
        'Amount',
        parent=styles['Heading1'],
        fontSize=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#276749'),
        spaceBefore=6,
        spaceAfter=6
    )
    
    style_amount_words = ParagraphStyle(
        'AmountWords',
        parent=styles['Normal'],
        fontSize=9,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#4a5568'),
        fontName='Helvetica-Oblique'
    )
    
    style_footer = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#a0aec0')
    )
    
    # Contenido
    elements = []
    
    # Logo y encabezado en tabla
    header_data = []
    
    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image(logo_path, width=1.2*inch, height=1.2*inch)
            logo.hAlign = 'CENTER'
            
            # Crear tabla con logo a la izquierda y texto a la derecha
            header_content = [
                Paragraph(CONDOMINIO_CONFIG["nombre_legal"], style_title),
                Paragraph(f"<b>{CONDOMINIO_CONFIG['nombre_comun']}</b>", style_subtitle),
                Paragraph(f"{CONDOMINIO_CONFIG['direccion']}", style_subtitle),
                Paragraph(f"{CONDOMINIO_CONFIG['ciudad']}", style_subtitle),
            ]
            
            header_table_data = [[logo, header_content]]
            header_table = Table(header_table_data, colWidths=[1.5*inch, 5.5*inch])
            header_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, 0), 'CENTER'),
                ('ALIGN', (1, 0), (1, 0), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            elements.append(header_table)
        except Exception:
            # Si falla cargar el logo, usar solo texto
            elements.append(Paragraph(CONDOMINIO_CONFIG["nombre_legal"], style_title))
            elements.append(Paragraph(f"<b>{CONDOMINIO_CONFIG['nombre_comun']}</b>", style_subtitle))
            elements.append(Paragraph(f"{CONDOMINIO_CONFIG['direccion']}, {CONDOMINIO_CONFIG['ciudad']}", style_subtitle))
    else:
        elements.append(Paragraph(CONDOMINIO_CONFIG["nombre_legal"], style_title))
        elements.append(Paragraph(f"<b>{CONDOMINIO_CONFIG['nombre_comun']}</b>", style_subtitle))
        elements.append(Paragraph(f"{CONDOMINIO_CONFIG['direccion']}, {CONDOMINIO_CONFIG['ciudad']}", style_subtitle))
    
    elements.append(Spacer(1, 0.2*inch))
    
    # Título del recibo
    elements.append(Paragraph("RECIBO DE PAGO", style_header))
    
    # Información del folio y fecha
    folio_data = [
        [
            Paragraph("<b>Folio:</b>", style_label),
            Paragraph(f"<b>{folio}</b>", style_value),
            Paragraph("<b>Fecha:</b>", style_label),
            Paragraph(_format_date(transaction_date), style_value)
        ]
    ]
    
    folio_table = Table(folio_data, colWidths=[1.2*inch, 2.5*inch, 1*inch, 2.5*inch])
    folio_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(folio_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Información del residente/unidad
    if unit_number or resident_name:
        resident_info = []
        if unit_number:
            resident_info.append([
                Paragraph("<b>Unidad:</b>", style_label),
                Paragraph(unit_number, style_value)
            ])
        if resident_name:
            resident_info.append([
                Paragraph("<b>Residente:</b>", style_label),
                Paragraph(resident_name, style_value)
            ])
        
        resident_table = Table(resident_info, colWidths=[1.5*inch, 5.5*inch])
        resident_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(resident_table)
        elements.append(Spacer(1, 0.15*inch))
    
    # Concepto del pago
    concept_data = [
        [Paragraph("<b>CONCEPTO</b>", style_label)],
        [Paragraph(description, style_value)],
        [Paragraph(f"<i>Categoría: {category_name}</i>", style_label)]
    ]
    
    concept_table = Table(concept_data, colWidths=[7*inch])
    concept_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f7fafc')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(concept_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Monto
    amount_box = [
        [Paragraph("<b>IMPORTE RECIBIDO</b>", style_label)],
        [Paragraph(_format_currency(amount), style_amount)],
        [Paragraph(f"({_numero_a_letras(amount)})", style_amount_words)]
    ]
    
    amount_table = Table(amount_box, colWidths=[7*inch])
    amount_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0fff4')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#276749')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(amount_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Método de pago y referencia
    payment_method_labels = {
        'cash': 'Efectivo',
        'transfer': 'Transferencia',
        'card': 'Tarjeta',
        'check': 'Cheque',
        'other': 'Otro'
    }
    payment_label = payment_method_labels.get(payment_method, payment_method or 'No especificado')
    
    payment_data = [
        [
            Paragraph("<b>Método de pago:</b>", style_label),
            Paragraph(payment_label, style_value),
        ]
    ]
    
    if reference_number:
        payment_data.append([
            Paragraph("<b>Referencia:</b>", style_label),
            Paragraph(reference_number, style_value),
        ])
    
    payment_table = Table(payment_data, colWidths=[1.5*inch, 5.5*inch])
    payment_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(payment_table)
    
    # Notas (si hay)
    if notes:
        elements.append(Spacer(1, 0.15*inch))
        notes_data = [
            [Paragraph("<b>Notas:</b>", style_label)],
            [Paragraph(notes, style_value)]
        ]
        notes_table = Table(notes_data, colWidths=[7*inch])
        notes_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fffaf0')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#ed8936')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(notes_table)
    
    elements.append(Spacer(1, 0.5*inch))
    
    # Firma - usar tesorero si está disponible
    signer_name = treasurer_name or "Administración"
    signer_title = "Tesorero(a)" if treasurer_name else "Administración"
    
    signature_data = [
        ['', ''],
        [
            '',
            Paragraph("_" * 40, style_value)
        ],
        [
            '',
            Paragraph(f"<b>{signer_name}</b>", ParagraphStyle('sig', parent=style_value, alignment=TA_CENTER))
        ],
        [
            '',
            Paragraph(signer_title, ParagraphStyle('sig2', parent=style_label, alignment=TA_CENTER))
        ]
    ]
    
    signature_table = Table(signature_data, colWidths=[3.5*inch, 3.5*inch])
    signature_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
    ]))
    elements.append(signature_table)
    
    elements.append(Spacer(1, 0.3*inch))
    
    # Pie de página
    elements.append(Paragraph(
        f"Documento generado el {_format_date(datetime.now())} | ID: {transaction_id[:8]}",
        style_footer
    ))
    elements.append(Paragraph(
        "Este recibo es un comprobante de pago válido para el condominio.",
        style_footer
    ))
    
    # Construir PDF
    doc.build(elements)
    buffer.seek(0)
    
    return buffer


def generate_folio(transaction_id: str, transaction_date) -> str:
    """
    Genera un folio legible para el recibo.
    Formato: REC-YYYYMM-XXXX (donde XXXX son los últimos 4 caracteres del ID)
    """
    year_month = transaction_date.strftime("%Y%m")
    short_id = transaction_id[-4:].upper()
    return f"REC-{year_month}-{short_id}"

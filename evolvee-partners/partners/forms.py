from django import forms

from partners.models import Partner, PaymentMethod


class PartnerProfileForm(forms.ModelForm):
    class Meta:
        model = Partner
        fields = ["bio"]
        widgets = {
            "bio": forms.Textarea(attrs={"rows": 3}),
        }


class PartnerPaymentMethodForm(forms.Form):
    payment_method = forms.ChoiceField(
        choices=[("", "Select payout method…"), *PaymentMethod.choices],
        required=True,
    )
